/**
 * IndexedDB storage for field notes (waypoints / lines / polygons / GPS tracks).
 * 既存の FieldNoteApp DB を v3 に上げて 'features' ストアを追加する。
 */

const DB_NAME = 'FieldNoteApp';
const DB_VERSION = 3;
const OVERLAY_STORE = 'overlays';
const GROUP_STORE = 'overlay-groups';
const FEATURE_STORE = 'features';

export type NoteFeatureType = 'waypoint' | 'line' | 'polygon' | 'track';

export interface PointGeometry {
  type: 'Point';
  coordinates: [number, number];
}
export interface LineStringGeometry {
  type: 'LineString';
  coordinates: [number, number][];
}
export interface PolygonGeometry {
  type: 'Polygon';
  coordinates: [number, number][][];
}
export type NoteGeometry = PointGeometry | LineStringGeometry | PolygonGeometry;

export interface TrackStats {
  /** 合計距離（メートル） */
  distanceM: number;
  /** 記録時間（ミリ秒） */
  durationMs: number;
  startTime: number;
  endTime: number;
  /** 記録ポイント数 */
  pointCount: number;
}

export interface NoteFeature {
  id: string;
  type: NoteFeatureType;
  name: string;
  description: string;
  /** 表示色 (hex) */
  color: string;
  geometry: NoteGeometry;
  createdAt: number;
  updatedAt: number;
  /** トラック記録の統計（type === 'track' のみ） */
  stats?: TrackStats;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        db.createObjectStore(OVERLAY_STORE, { keyPath: 'id' });
      }
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(GROUP_STORE)) {
          db.createObjectStore(GROUP_STORE, { keyPath: 'id' });
        }
      }
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains(FEATURE_STORE)) {
          db.createObjectStore(FEATURE_STORE, { keyPath: 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFeature(feature: NoteFeature): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FEATURE_STORE, 'readwrite');
    tx.objectStore(FEATURE_STORE).put(feature);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAllFeatures(): Promise<NoteFeature[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FEATURE_STORE, 'readonly');
    const req = tx.objectStore(FEATURE_STORE).getAll();
    req.onsuccess = () => {
      const features = (req.result as NoteFeature[]).sort(
        (a, b) => b.createdAt - a.createdAt,
      );
      resolve(features);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteFeature(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FEATURE_STORE, 'readwrite');
    tx.objectStore(FEATURE_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateFeatureMeta(
  id: string,
  patch: Partial<Pick<NoteFeature, 'name' | 'description' | 'color'>>,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FEATURE_STORE, 'readwrite');
    const store = tx.objectStore(FEATURE_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result as NoteFeature | undefined;
      if (record) {
        store.put({ ...record, ...patch, updatedAt: Date.now() });
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
