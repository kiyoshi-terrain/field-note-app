import { useRef, useEffect, useCallback, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView from '@/components/map/MapView';
import type { MapViewHandle, TileSource } from '@/components/map/types';
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
});
