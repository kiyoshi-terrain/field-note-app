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

export interface MapViewHandle {
  updateLocation: (lng: number, lat: number, accuracy: number | null) => void;
  flyToLocation: (lng: number, lat: number, zoom?: number) => void;
  hideLocation: () => void;
  setTileSource: (source: TileSource) => void;
}
