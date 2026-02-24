import type { MapOptions } from './types';

const DEFAULT_CENTER: [number, number] = [139.6917, 35.6895]; // Tokyo
const DEFAULT_ZOOM = 13;
const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const PMTILES_URL = 'https://build.protomaps.com/20240529.pmtiles';

export function generateMapHtml(options?: MapOptions): string {
  const center = options?.center ?? DEFAULT_CENTER;
  const zoom = options?.zoom ?? DEFAULT_ZOOM;
  const tileUrl = options?.tileUrl ?? DEFAULT_TILE_URL;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport"
    content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <script src="https://unpkg.com/maplibre-gl@5.18.0/dist/maplibre-gl.js"><\/script>
  <script src="https://unpkg.com/pmtiles@4.3.0/dist/pmtiles.js"><\/script>
  <link href="https://unpkg.com/maplibre-gl@5.18.0/dist/maplibre-gl.css" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    #map { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    // --- PMTiles protocol registration ---
    var pmtilesProtocol = new pmtiles.Protocol();
    maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile);

    var PMTILES_URL = '${PMTILES_URL}';

    // --- Protomaps light style layers for vector tiles ---
    var pmtilesLayers = [
      { id: 'pm-background', type: 'background', paint: { 'background-color': '#f0f0f0' }, layout: { visibility: 'none' } },
      { id: 'pm-earth', type: 'fill', source: 'pmtiles', 'source-layer': 'earth', paint: { 'fill-color': '#e8e4da' }, layout: { visibility: 'none' } },
      { id: 'pm-water', type: 'fill', source: 'pmtiles', 'source-layer': 'water', paint: { 'fill-color': '#aad3df' }, layout: { visibility: 'none' } },
      { id: 'pm-landuse-park', type: 'fill', source: 'pmtiles', 'source-layer': 'landuse', filter: ['any', ['==', 'pmap:kind', 'park'], ['==', 'pmap:kind', 'nature_reserve'], ['==', 'pmap:kind', 'forest']], paint: { 'fill-color': '#c8e6c0' }, layout: { visibility: 'none' } },
      { id: 'pm-landuse-residential', type: 'fill', source: 'pmtiles', 'source-layer': 'landuse', filter: ['==', 'pmap:kind', 'residential'], paint: { 'fill-color': '#e8e0d8' }, layout: { visibility: 'none' } },
      { id: 'pm-buildings', type: 'fill', source: 'pmtiles', 'source-layer': 'buildings', paint: { 'fill-color': '#d9d0c5', 'fill-opacity': 0.7 }, layout: { visibility: 'none' } },
      { id: 'pm-roads-minor', type: 'line', source: 'pmtiles', 'source-layer': 'roads', filter: ['any', ['==', 'pmap:kind', 'minor_road'], ['==', 'pmap:kind', 'other']], paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 16, 4] }, layout: { visibility: 'none' } },
      { id: 'pm-roads-major', type: 'line', source: 'pmtiles', 'source-layer': 'roads', filter: ['any', ['==', 'pmap:kind', 'major_road']], paint: { 'line-color': '#ffd080', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 16, 6] }, layout: { visibility: 'none' } },
      { id: 'pm-roads-highway', type: 'line', source: 'pmtiles', 'source-layer': 'roads', filter: ['any', ['==', 'pmap:kind', 'highway']], paint: { 'line-color': '#ffb347', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 16, 8] }, layout: { visibility: 'none' } },
      { id: 'pm-transit-rail', type: 'line', source: 'pmtiles', 'source-layer': 'transit', filter: ['any', ['==', 'pmap:kind', 'rail']], paint: { 'line-color': '#aaaaaa', 'line-width': 1, 'line-dasharray': [4, 2] }, layout: { visibility: 'none' } },
      { id: 'pm-boundaries', type: 'line', source: 'pmtiles', 'source-layer': 'boundaries', paint: { 'line-color': '#999999', 'line-width': 1, 'line-dasharray': [3, 2] }, layout: { visibility: 'none' } },
      { id: 'pm-labels-places', type: 'symbol', source: 'pmtiles', 'source-layer': 'places', paint: { 'text-color': '#333333', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 }, layout: { visibility: 'none', 'text-field': ['coalesce', ['get', 'name:ja'], ['get', 'name']], 'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 14, 16], 'text-font': ['Noto Sans Regular'] } },
      { id: 'pm-labels-roads', type: 'symbol', source: 'pmtiles', 'source-layer': 'roads', minzoom: 13, paint: { 'text-color': '#555555', 'text-halo-color': '#ffffff', 'text-halo-width': 1 }, layout: { visibility: 'none', 'text-field': ['coalesce', ['get', 'name:ja'], ['get', 'name']], 'text-size': 11, 'symbol-placement': 'line', 'text-font': ['Noto Sans Regular'] } }
    ];

    var map = new maplibregl.Map({
      container: 'map',
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          'osm-raster': {
            type: 'raster',
            tiles: ['${tileUrl}'],
            tileSize: 256,
            maxzoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          },
          'pmtiles': {
            type: 'vector',
            url: 'pmtiles://' + PMTILES_URL,
            attribution: '&copy; <a href="https://protomaps.com">Protomaps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          },
          'gsi-pale': {
            type: 'raster',
            tiles: ['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 18,
            attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>'
          },
          'gsi-photo': {
            type: 'raster',
            tiles: ['https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg'],
            tileSize: 256,
            maxzoom: 18,
            attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>'
          },
          'gsi-hillshade': {
            type: 'raster',
            tiles: ['https://cyberjapandata.gsi.go.jp/xyz/hillshademap/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 16,
            attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>'
          }
        },
        layers: [
          {
            id: 'osm-raster-layer',
            type: 'raster',
            source: 'osm-raster'
          },
          {
            id: 'gsi-pale-layer',
            type: 'raster',
            source: 'gsi-pale',
            layout: { visibility: 'none' }
          },
          {
            id: 'gsi-photo-layer',
            type: 'raster',
            source: 'gsi-photo',
            layout: { visibility: 'none' }
          },
          {
            id: 'gsi-hillshade-layer',
            type: 'raster',
            source: 'gsi-hillshade',
            layout: { visibility: 'none' }
          }
        ].concat(pmtilesLayers)
      },
      center: [${center[0]}, ${center[1]}],
      zoom: ${zoom}
    });

    // --- Tile source switching ---
    var currentTileSource = 'osm';

    var allRasterLayers = ['osm-raster-layer', 'gsi-pale-layer', 'gsi-photo-layer', 'gsi-hillshade-layer'];

    function setTileSource(source) {
      // Hide all raster layers
      allRasterLayers.forEach(function(id) {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', 'none');
        }
      });
      // Hide all PMTiles layers
      pmtilesLayers.forEach(function(layer) {
        if (map.getLayer(layer.id)) {
          map.setLayoutProperty(layer.id, 'visibility', 'none');
        }
      });

      // Show selected source
      if (source === 'pmtiles') {
        pmtilesLayers.forEach(function(layer) {
          if (map.getLayer(layer.id)) {
            map.setLayoutProperty(layer.id, 'visibility', 'visible');
          }
        });
      } else {
        var layerMap = {
          'osm': 'osm-raster-layer',
          'gsi-pale': 'gsi-pale-layer',
          'gsi-photo': 'gsi-photo-layer',
          'gsi-hillshade': 'gsi-hillshade-layer'
        };
        var layerId = layerMap[source] || 'osm-raster-layer';
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', 'visible');
        }
      }
      currentTileSource = source;
    }

    // --- GPS user location source & layers ---
    map.on('load', function() {
      map.addSource('user-location', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: {}
        }
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
          'circle-pitch-alignment': 'map'
        },
        layout: { 'visibility': 'none' }
      });

      map.addLayer({
        id: 'user-location-pulse',
        type: 'circle',
        source: 'user-location',
        paint: {
          'circle-radius': 18,
          'circle-color': 'rgba(66, 133, 244, 0.2)',
          'circle-pitch-alignment': 'map'
        },
        layout: { 'visibility': 'none' }
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
          'circle-pitch-alignment': 'map'
        },
        layout: { 'visibility': 'none' }
      });

      var message = JSON.stringify({ type: 'mapLoaded' });
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(message);
      }

      startPulseAnimation();
    });

    // --- Pulse animation ---
    var pulseDirection = 1;
    var pulseRadius = 18;
    function startPulseAnimation() {
      function animatePulse() {
        pulseRadius += pulseDirection * 0.3;
        if (pulseRadius >= 24) pulseDirection = -1;
        if (pulseRadius <= 16) pulseDirection = 1;
        if (map.getLayer('user-location-pulse')) {
          map.setPaintProperty('user-location-pulse', 'circle-radius', pulseRadius);
          map.setPaintProperty('user-location-pulse', 'circle-opacity',
            0.4 - ((pulseRadius - 16) / (24 - 16)) * 0.3
          );
        }
        requestAnimationFrame(animatePulse);
      }
      animatePulse();
    }

    // --- Command handler for React Native ---
    function handleCommand(cmd) {
      switch (cmd.type) {
        case 'updateLocation':
          updateUserLocation(cmd.longitude, cmd.latitude, cmd.accuracy);
          break;
        case 'flyToLocation':
          map.flyTo({
            center: [cmd.longitude, cmd.latitude],
            zoom: cmd.zoom || 16,
            duration: 1500
          });
          break;
        case 'hideLocation':
          setLocationLayersVisibility('none');
          break;
        case 'setTileSource':
          setTileSource(cmd.source);
          break;
      }
    }

    function updateUserLocation(lng, lat, accuracy) {
      var source = map.getSource('user-location');
      if (!source) return;

      var metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, map.getZoom());
      var accuracyRadius = accuracy ? Math.min(Math.max(accuracy / metersPerPixel, 10), 100) : 0;

      source.setData({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { accuracyRadius: accuracyRadius }
      });

      setLocationLayersVisibility('visible');
    }

    function setLocationLayersVisibility(visibility) {
      ['user-location-accuracy', 'user-location-pulse', 'user-location-dot'].forEach(function(id) {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', visibility);
        }
      });
    }

    map.on('moveend', function() {
      var c = map.getCenter();
      var message = JSON.stringify({
        type: 'mapMoved',
        center: [c.lng, c.lat],
        zoom: map.getZoom()
      });
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(message);
      }
    });
  <\/script>
</body>
</html>`;
}
