import type { NoteFeature, NoteGeometry } from '@/lib/feature-store';

export interface MapOptions {
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  tileUrl?: string;
}

/** 描画モード（Terra Drawのモード名と対応） */
export type DrawMode = 'point' | 'linestring' | 'polygon';

export interface MapViewProps {
  options?: MapOptions;
  onMapMoved?: (center: [number, number], zoom: number) => void;
  onMapLoaded?: () => void;
  /** 描画完了時（点はクリック時、ライン/ポリゴンは確定時） */
  onDrawComplete?: (geometry: NoteGeometry) => void;
  /** 保存済みノートFeatureのタップ時 */
  onFeaturePress?: (id: string) => void;
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
  /** 描画モードを開始（point / linestring / polygon） */
  startDrawing: (mode: DrawMode) => void;
  /** 描画を中断して静的モードに戻す */
  cancelDrawing: () => void;
  /** 保存済みノートFeatureを地図に反映（全置換） */
  setNoteFeatures: (features: NoteFeature[]) => void;
  /** 記録中のGPSトラックを描画（nullで消去） */
  updateRecordingTrack: (coords: [number, number][] | null) => void;
}
