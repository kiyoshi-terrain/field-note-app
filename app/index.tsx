import { useRef, useEffect, useCallback, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView from '@/components/map/MapView';
import type { MapViewHandle, TileSource, OverlayInfo } from '@/components/map/types';
import { useLocation } from '@/hooks/use-location';

const TILE_SOURCE_OPTIONS: { id: TileSource; label: string }[] = [
  { id: 'osm', label: 'OSM' },
  { id: 'gsi-pale', label: '地理院 淡色' },
  { id: 'gsi-photo', label: '地理院 航空写真' },
  { id: 'gsi-hillshade', label: '地理院 陰影起伏' },
  { id: 'pmtiles', label: 'PMTiles ベクター' },
];

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapViewHandle>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [tileSource, setTileSource] = useState<TileSource>('osm');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [overlays, setOverlays] = useState<OverlayInfo[]>([]);
  const [showOverlayMenu, setShowOverlayMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { location, error, isLoading, getCurrentPosition } = useLocation({
    enabled: true,
    distanceInterval: 5,
    timeInterval: 3000,
  });

  // Send location updates to the map
  useEffect(() => {
    if (location && mapLoaded && mapRef.current) {
      mapRef.current.updateLocation(
        location.longitude,
        location.latitude,
        location.accuracy
      );
    }
  }, [location, mapLoaded]);

  const handleLocateMe = useCallback(async () => {
    const pos = await getCurrentPosition();
    if (pos && mapRef.current) {
      mapRef.current.flyToLocation(pos.longitude, pos.latitude, 16);
    }
  }, [getCurrentPosition]);

  const handleMapLoaded = useCallback(() => {
    setMapLoaded(true);
  }, []);

  const handleToggleLayerMenu = useCallback(() => {
    setShowLayerMenu((prev) => !prev);
  }, []);

  const handleSelectTileSource = useCallback((source: TileSource) => {
    setTileSource(source);
    mapRef.current?.setTileSource(source);
    setShowLayerMenu(false);
  }, []);

  const handleAddOverlay = useCallback(() => {
    setShowOverlayMenu(false);
    if (Platform.OS === 'web') {
      // Create hidden file input and trigger it
      if (!fileInputRef.current) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pmtiles';
        input.style.display = 'none';
        input.addEventListener('change', async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;
          const blobUrl = URL.createObjectURL(file);
          const id = file.name.replace(/\.pmtiles$/i, '');
          const info = await mapRef.current?.addRasterOverlay(id, blobUrl);
          if (info) {
            info.name = file.name.replace(/\.pmtiles$/i, '');
            info.opacity = 0.8;
            setOverlays((prev) => [...prev.filter((o) => o.id !== id), info]);
          }
          input.value = '';
        });
        document.body.appendChild(input);
        fileInputRef.current = input;
      }
      fileInputRef.current.click();
    }
  }, []);

  const handleRemoveOverlay = useCallback((id: string) => {
    mapRef.current?.removeRasterOverlay(id);
    setOverlays((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const handleOverlayOpacityChange = useCallback((id: string, opacity: number) => {
    mapRef.current?.setOverlayOpacity(id, opacity);
    setOverlays((prev) =>
      prev.map((o) => (o.id === id ? { ...o, opacity } : o))
    );
  }, []);

  const handleFlyToOverlay = useCallback((overlay: OverlayInfo) => {
    const [west, south, east, north] = overlay.bounds;
    const centerLng = (west + east) / 2;
    const centerLat = (south + north) / 2;
    mapRef.current?.flyToLocation(centerLng, centerLat, 15);
    setShowOverlayMenu(false);
  }, []);

  const formatCoord = (value: number, isLat: boolean): string => {
    const dir = isLat ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
    return `${Math.abs(value).toFixed(6)}\u00B0 ${dir}`;
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        options={{
          center: [139.6917, 35.6895],
          zoom: 13,
        }}
        onMapLoaded={handleMapLoaded}
      />

      {/* Coordinate overlay bar */}
      {location && (
        <View style={[styles.coordBar, { top: insets.top + 8 }]}>
          <View style={styles.coordContent}>
            <Ionicons name="navigate" size={14} color="#4285F4" style={styles.coordIcon} />
            <Text style={styles.coordText}>
              {formatCoord(location.latitude, true)}  {formatCoord(location.longitude, false)}
            </Text>
            {location.accuracy != null && (
              <Text style={styles.accuracyText}>
                {'\u00B1'}{location.accuracy.toFixed(0)}m
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Loading indicator */}
      {isLoading && !location && (
        <View style={[styles.coordBar, { top: insets.top + 8 }]}>
          <View style={styles.coordContent}>
            <Text style={styles.coordText}>Getting GPS fix...</Text>
          </View>
        </View>
      )}

      {/* Error display */}
      {error && (
        <View style={[styles.coordBar, styles.errorBar, { top: insets.top + 8 }]}>
          <View style={styles.coordContent}>
            <Ionicons name="warning" size={14} color="#FF6B6B" style={styles.coordIcon} />
            <Text style={[styles.coordText, styles.errorText]}>{error}</Text>
          </View>
        </View>
      )}

      {/* Layer menu backdrop */}
      {showLayerMenu && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setShowLayerMenu(false)}
        />
      )}

      {/* Layer popup menu */}
      {showLayerMenu && (
        <View style={[styles.layerMenu, { bottom: insets.bottom + 84 }]}>
          {TILE_SOURCE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={styles.layerMenuItem}
              onPress={() => handleSelectTileSource(opt.id)}
              activeOpacity={0.6}
            >
              <Text style={styles.layerMenuCheck}>
                {tileSource === opt.id ? '\u2713' : '  '}
              </Text>
              <Text style={styles.layerMenuLabel}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Overlay menu backdrop */}
      {showOverlayMenu && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setShowOverlayMenu(false)}
        />
      )}

      {/* Overlay popup menu */}
      {showOverlayMenu && (
        <View style={[styles.layerMenu, { bottom: insets.bottom + 144 }]}>
          <TouchableOpacity
            style={styles.layerMenuItem}
            onPress={handleAddOverlay}
            activeOpacity={0.6}
          >
            <Ionicons name="add-circle-outline" size={16} color="#4285F4" style={{ marginRight: 6 }} />
            <Text style={styles.layerMenuLabel}>PMTilesを追加...</Text>
          </TouchableOpacity>
          {overlays.map((overlay) => (
            <View key={overlay.id}>
              <View style={styles.overlayItem}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => handleFlyToOverlay(overlay)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.layerMenuLabel} numberOfLines={1}>{overlay.name}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleRemoveOverlay(overlay.id)}
                  activeOpacity={0.6}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={18} color="#FF6B6B" />
                </TouchableOpacity>
              </View>
              {Platform.OS === 'web' && (
                <View style={styles.sliderRow}>
                  <Ionicons name="eye-outline" size={14} color="#888" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(overlay.opacity * 100)}
                    onChange={(e: any) =>
                      handleOverlayOpacityChange(overlay.id, Number(e.target.value) / 100)
                    }
                    style={{ flex: 1, margin: '0 8px', accentColor: '#4285F4' } as any}
                  />
                  <Text style={styles.opacityLabel}>{Math.round(overlay.opacity * 100)}%</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Overlay button */}
      <TouchableOpacity
        style={[styles.controlButton, { bottom: insets.bottom + 144 }]}
        onPress={() => setShowOverlayMenu((prev) => !prev)}
        activeOpacity={0.7}
      >
        <Ionicons
          name="map"
          size={24}
          color={overlays.length > 0 ? '#34A853' : '#4285F4'}
        />
      </TouchableOpacity>

      {/* Layer toggle button */}
      <TouchableOpacity
        style={[styles.controlButton, { bottom: insets.bottom + 84 }]}
        onPress={handleToggleLayerMenu}
        activeOpacity={0.7}
      >
        <Ionicons
          name="layers"
          size={24}
          color={tileSource !== 'osm' ? '#34A853' : '#4285F4'}
        />
      </TouchableOpacity>

      {/* Locate me button */}
      <TouchableOpacity
        style={[styles.controlButton, { bottom: insets.bottom + 24 }]}
        onPress={handleLocateMe}
        activeOpacity={0.7}
      >
        <Ionicons name="locate" size={24} color="#4285F4" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  coordBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 10,
  },
  errorBar: {
    backgroundColor: 'rgba(80, 0, 0, 0.8)',
  },
  coordContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coordIcon: {
    marginRight: 6,
  },
  coordText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },
  accuracyText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    marginLeft: 8,
  },
  errorText: {
    color: '#FF6B6B',
  },
  controlButton: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
    elevation: 4,
    zIndex: 10,
  },
  layerMenu: {
    position: 'absolute',
    right: 72,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 4,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.3)',
    elevation: 6,
    zIndex: 20,
    minWidth: 180,
  },
  layerMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  layerMenuCheck: {
    width: 20,
    fontSize: 14,
    fontWeight: '700',
    color: '#4285F4',
  },
  layerMenuLabel: {
    fontSize: 14,
    color: '#333333',
  },
  overlayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 4,
  },
  opacityLabel: {
    fontSize: 11,
    color: '#888',
    width: 32,
    textAlign: 'right',
  },
});
