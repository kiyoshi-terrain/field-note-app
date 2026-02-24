import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol, PMTiles } from 'pmtiles';
import type { MapViewProps, MapViewHandle, TileSource, OverlayInfo } from './types';

const DEFAULT_CENTER: [number, number] = [139.6917, 35.6895];
const DEFAULT_ZOOM = 13;
const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const PMTILES_URL = 'https://build.protomaps.com/20240529.pmtiles';

// Register PMTiles protocol once
const pmtilesProtocol = new Protocol();
maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile);

// Protomaps light style layers for vector tiles
const PMTILES_LAYER_IDS = [
  'pm-background', 'pm-earth', 'pm-water', 'pm-landuse-park',
  'pm-landuse-residential', 'pm-buildings', 'pm-roads-minor',
  'pm-roads-major', 'pm-roads-highway', 'pm-transit-rail',
  'pm-boundaries', 'pm-labels-places', 'pm-labels-roads',
] as const;

const pmtilesLayers: maplibregl.LayerSpecification[] = [
  { id: 'pm-background', type: 'background', paint: { 'background-color': '#f0f0f0' }, layout: { visibility: 'none' } },
  { id: 'pm-earth', type: 'fill', source: 'pmtiles', 'source-layer': 'earth', paint: { 'fill-color': '#e8e4da' }, layout: { visibility: 'none' } },
  { id: 'pm-water', type: 'fill', source: 'pmtiles', 'source-layer': 'water', paint: { 'fill-color': '#aad3df' }, layout: { visibility: 'none' } },
  { id: 'pm-landuse-park', type: 'fill', source: 'pmtiles', 'source-layer': 'landuse', filter: ['any', ['==', 'pmap:kind', 'park'], ['==', 'pmap:kind', 'nature_reserve'], ['==', 'pmap:kind', 'forest']], paint: { 'fill-color': '#c8e6c0' }, layout: { visibility: 'none' } },
  { id: 'pm-landuse-residential', type: 'fill', source: 'pmtiles', 'source-layer': 'landuse', filter: ['==', 'pmap:kind', 'residential'], paint: { 'fill-color': '#e8e0d8' }, layout: { visibility: 'none' } },
  { id: 'pm-buildings', type: 'fill', source: 'pmtiles', 'source-layer': 'buildings', paint: { 'fill-color': '#d9d0c5', 'fill-opacity': 0.7 }, layout: { visibility: 'none' } },
  { id: 'pm-roads-minor', type: 'line', source: 'pmtiles', 'source-layer': 'roads', filter: ['any', ['==', 'pmap:kind', 'minor_road'], ['==', 'pmap:kind', 'other']], paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 16, 4] }, layout: { visibility: 'none' } },
  { id: 'pm-roads-major', type: 'line', source: 'pmtiles', 'source-layer': 'roads', filter: ['==', 'pmap:kind', 'major_road'], paint: { 'line-color': '#ffd080', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 16, 6] }, layout: { visibility: 'none' } },
  { id: 'pm-roads-highway', type: 'line', source: 'pmtiles', 'source-layer': 'roads', filter: ['==', 'pmap:kind', 'highway'], paint: { 'line-color': '#ffb347', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 16, 8] }, layout: { visibility: 'none' } },
  { id: 'pm-transit-rail', type: 'line', source: 'pmtiles', 'source-layer': 'transit', filter: ['==', 'pmap:kind', 'rail'], paint: { 'line-color': '#aaaaaa', 'line-width': 1, 'line-dasharray': [4, 2] }, layout: { visibility: 'none' } },
  { id: 'pm-boundaries', type: 'line', source: 'pmtiles', 'source-layer': 'boundaries', paint: { 'line-color': '#999999', 'line-width': 1, 'line-dasharray': [3, 2] }, layout: { visibility: 'none' } },
  { id: 'pm-labels-places', type: 'symbol', source: 'pmtiles', 'source-layer': 'places', paint: { 'text-color': '#333333', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 }, layout: { visibility: 'none', 'text-field': ['coalesce', ['get', 'name:ja'], ['get', 'name']], 'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 14, 16], 'text-font': ['Noto Sans Regular'] } },
  { id: 'pm-labels-roads', type: 'symbol', source: 'pmtiles', 'source-layer': 'roads', minzoom: 13, paint: { 'text-color': '#555555', 'text-halo-color': '#ffffff', 'text-halo-width': 1 }, layout: { visibility: 'none', 'text-field': ['coalesce', ['get', 'name:ja'], ['get', 'name']], 'text-size': 11, 'symbol-placement': 'line', 'text-font': ['Noto Sans Regular'] } },
];

export default forwardRef<MapViewHandle, MapViewProps>(
  function MapView({ options, onMapMoved, onMapLoaded }, ref) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const pulseAnimRef = useRef<number>(0);

    const center = options?.center ?? DEFAULT_CENTER;
    const zoom = options?.zoom ?? DEFAULT_ZOOM;
    const tileUrl = options?.tileUrl ?? DEFAULT_TILE_URL;

    useImperativeHandle(ref, () => ({
      updateLocation(lng: number, lat: number, accuracy: number | null) {
        const map = mapRef.current;
        if (!map) return;

        const source = map.getSource('user-location') as maplibregl.GeoJSONSource | undefined;
        if (!source) return;

        const metersPerPixel =
          (156543.03392 * Math.cos((lat * Math.PI) / 180)) /
          Math.pow(2, map.getZoom());
        const accuracyRadius = accuracy
          ? Math.min(Math.max(accuracy / metersPerPixel, 10), 100)
          : 0;

        source.setData({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: { accuracyRadius },
        });

        ['user-location-accuracy', 'user-location-pulse', 'user-location-dot'].forEach((id) => {
          if (map.getLayer(id)) {
            map.setLayoutProperty(id, 'visibility', 'visible');
          }
        });
      },

      flyToLocation(lng: number, lat: number, zoomLevel?: number) {
        mapRef.current?.flyTo({
          center: [lng, lat],
          zoom: zoomLevel ?? 16,
          duration: 1500,
        });
      },

      hideLocation() {
        const map = mapRef.current;
        if (!map) return;
        ['user-location-accuracy', 'user-location-pulse', 'user-location-dot'].forEach((id) => {
          if (map.getLayer(id)) {
            map.setLayoutProperty(id, 'visibility', 'none');
          }
        });
      },

      setTileSource(source: TileSource) {
        const map = mapRef.current;
        if (!map) return;

        const allRasterLayers = ['osm-raster-layer', 'gsi-pale-layer', 'gsi-photo-layer', 'gsi-hillshade-layer'];

        // Hide all raster layers
        allRasterLayers.forEach((id) => {
          if (map.getLayer(id)) {
            map.setLayoutProperty(id, 'visibility', 'none');
          }
        });
        // Hide all PMTiles layers
        PMTILES_LAYER_IDS.forEach((id) => {
          if (map.getLayer(id)) {
            map.setLayoutProperty(id, 'visibility', 'none');
          }
        });

        // Show selected source
        if (source === 'pmtiles') {
          PMTILES_LAYER_IDS.forEach((id) => {
            if (map.getLayer(id)) {
              map.setLayoutProperty(id, 'visibility', 'visible');
            }
          });
        } else {
          const layerMap: Record<string, string> = {
            'osm': 'osm-raster-layer',
            'gsi-pale': 'gsi-pale-layer',
            'gsi-photo': 'gsi-photo-layer',
            'gsi-hillshade': 'gsi-hillshade-layer',
          };
          const layerId = layerMap[source] ?? 'osm-raster-layer';
          if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', 'visible');
          }
        }
      },

      async addRasterOverlay(id: string, pmtilesUrl: string): Promise<OverlayInfo | null> {
        const map = mapRef.current;
        if (!map) return null;

        try {
          // Read PMTiles header to get bounds and metadata
          const p = new PMTiles(pmtilesUrl);
          const header = await p.getHeader();

          const bounds: [number, number, number, number] = [
            header.minLon, header.minLat, header.maxLon, header.maxLat,
          ];

          const sourceId = `overlay-${id}`;
          const layerId = `overlay-${id}-layer`;

          // Remove existing overlay with same id
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);

          // Add as raster source via pmtiles protocol
          map.addSource(sourceId, {
            type: 'raster',
            url: `pmtiles://${pmtilesUrl}`,
            tileSize: 256,
          });

          // Insert overlay layer below GPS layers
          const beforeLayerId = map.getLayer('user-location-accuracy') ? 'user-location-accuracy' : undefined;

          map.addLayer({
            id: layerId,
            type: 'raster',
            source: sourceId,
            paint: { 'raster-opacity': 0.8 },
          }, beforeLayerId);

          // Fly to overlay bounds
          map.fitBounds(bounds, { padding: 20, duration: 1500 });

          const name = id;
          return { id, name, bounds, opacity: 0.8 };
        } catch (e) {
          console.error('Failed to add raster overlay:', e);
          return null;
        }
      },

      removeRasterOverlay(id: string) {
        const map = mapRef.current;
        if (!map) return;

        const layerId = `overlay-${id}-layer`;
        const sourceId = `overlay-${id}`;

        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      },

      setOverlayOpacity(id: string, opacity: number) {
        const map = mapRef.current;
        if (!map) return;

        const layerId = `overlay-${id}-layer`;
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'raster-opacity', opacity);
        }
      },
    }), []);

    useEffect(() => {
      if (!mapContainerRef.current || mapRef.current) return;

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
          sources: {
            'osm-raster': {
              type: 'raster',
              tiles: [tileUrl],
              tileSize: 256,
              maxzoom: 19,
              attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            },
            'pmtiles': {
              type: 'vector',
              url: `pmtiles://${PMTILES_URL}`,
              attribution:
                '&copy; <a href="https://protomaps.com">Protomaps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            },
            'gsi-pale': {
              type: 'raster',
              tiles: ['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'],
              tileSize: 256,
              maxzoom: 18,
              attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
            },
            'gsi-photo': {
              type: 'raster',
              tiles: ['https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg'],
              tileSize: 256,
              maxzoom: 18,
              attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
            },
            'gsi-hillshade': {
              type: 'raster',
              tiles: ['https://cyberjapandata.gsi.go.jp/xyz/hillshademap/{z}/{x}/{y}.png'],
              tileSize: 256,
              maxzoom: 16,
              attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
            },
          },
          layers: [
            {
              id: 'osm-raster-layer',
              type: 'raster',
              source: 'osm-raster',
            },
            {
              id: 'gsi-pale-layer',
              type: 'raster',
              source: 'gsi-pale',
              layout: { visibility: 'none' },
            },
            {
              id: 'gsi-photo-layer',
              type: 'raster',
              source: 'gsi-photo',
              layout: { visibility: 'none' },
            },
            {
              id: 'gsi-hillshade-layer',
              type: 'raster',
              source: 'gsi-hillshade',
              layout: { visibility: 'none' },
            },
            ...pmtilesLayers,
          ],
        },
        center,
        zoom,
      });

      map.on('load', () => {
        // GPS source & layers
        map.addSource('user-location', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [0, 0] },
            properties: {},
          },
        });

        map.addLayer({
          id: 'user-location-accuracy',
          type: 'circle',
          source: 'user-location',
          paint: {
            'circle-radius': ['get', 'accuracyRadius'],
            'circle-color': 'rgba(66, 133, 244, 0.15)',
            'circle-stroke-color': 'rgba(66, 133, 244, 0.3)',
            'circle-stroke-width': 1,
            'circle-pitch-alignment': 'map',
          },
          layout: { visibility: 'none' },
        });

        map.addLayer({
          id: 'user-location-pulse',
          type: 'circle',
          source: 'user-location',
          paint: {
            'circle-radius': 18,
            'circle-color': 'rgba(66, 133, 244, 0.2)',
            'circle-pitch-alignment': 'map',
          },
          layout: { visibility: 'none' },
        });

        map.addLayer({
          id: 'user-location-dot',
          type: 'circle',
          source: 'user-location',
          paint: {
            'circle-radius': 8,
            'circle-color': '#4285F4',
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-width': 3,
            'circle-pitch-alignment': 'map',
          },
          layout: { visibility: 'none' },
        });

        // Pulse animation
        let pulseDir = 1;
        let pulseR = 18;
        function animatePulse() {
          pulseR += pulseDir * 0.3;
          if (pulseR >= 24) pulseDir = -1;
          if (pulseR <= 16) pulseDir = 1;
          if (map.getLayer('user-location-pulse')) {
            map.setPaintProperty('user-location-pulse', 'circle-radius', pulseR);
            map.setPaintProperty(
              'user-location-pulse',
              'circle-opacity',
              0.4 - ((pulseR - 16) / (24 - 16)) * 0.3
            );
          }
          pulseAnimRef.current = requestAnimationFrame(animatePulse);
        }
        animatePulse();

        onMapLoaded?.();
      });

      map.on('moveend', () => {
        const c = map.getCenter();
        onMapMoved?.([c.lng, c.lat], map.getZoom());
      });

      mapRef.current = map;

      return () => {
        cancelAnimationFrame(pulseAnimRef.current);
        map.remove();
        mapRef.current = null;
      };
    }, []);

    return (
      <View style={styles.container}>
        <div
          ref={mapContainerRef}
          style={{ width: '100%', height: '100%' }}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
