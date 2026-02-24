export interface MapOptions {
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  tileUrl?: string;
}

export interface MapViewProps {
  options?: MapOptions;
  onMapMoved?: (center: [number, number], zoom: number) => void;
  onMapLoaded?: () => void;
}

export type TileSource = 'osm' | 'pmtiles' | 'gsi-pale' | 'gsi-photo' | 'gsi-hillshade';

export interface OverlayInfo {
  id: string;
  name: string;
  bounds: [number, number, number, number]; // [west, south, east, north]
  opacity: number; // 0.0 - 1.0
}

export interface MapViewHandle {
  updateLocation: (lng: number, lat: number, accuracy: number | null) => void;
  flyToLocation: (lng: number, lat: number, zoom?: number) => void;
  hideLocation: () => void;
  setTileSource: (source: TileSource) => void;
  addRasterOverlay: (id: string, pmtilesUrl: string) => Promise<OverlayInfo | null>;
  removeRasterOverlay: (id: string) => void;
  setOverlayOpacity: (id: string, opacity: number) => void;
}
