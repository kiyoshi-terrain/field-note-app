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
  visible: boolean; // true = visible, false = hidden
  groupId: string; // group ID (default: 'default')
}

export interface OverlayGroup {
  id: string; // 'default', 'shikoku-2024', etc.
  name: string; // '未分類', '四国調査 2024', etc.
  expanded: boolean; // UI collapse state
  order: number; // display order
}

export interface MapViewHandle {
  updateLocation: (lng: number, lat: number, accuracy: number | null) => void;
  flyToLocation: (lng: number, lat: number, zoom?: number) => void;
  hideLocation: () => void;
  setTileSource: (source: TileSource) => void;
  addRasterOverlay: (id: string, pmtilesUrl: string) => Promise<OverlayInfo | null>;
  removeRasterOverlay: (id: string) => void;
  setOverlayOpacity: (id: string, opacity: number) => void;
  toggleOverlayVisibility: (id: string, visible: boolean) => void;
  fitToBounds: (bounds: [number, number, number, number]) => void;
  /** Add all MLIT hazard vector tile sources & layers (initially hidden) */
  addHazardLayers: () => void;
  /** Toggle a hazard layer visibility */
  toggleHazardLayer: (id: string, visible: boolean) => void;
  /** Set hazard layer fill opacity */
  setHazardOpacity: (id: string, opacity: number) => void;
}
