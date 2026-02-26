/**
 * IndexedDB storage for PMTiles overlay files & groups.
 * Persists overlay binary data + metadata so they survive page reloads.
 */

const DB_NAME = 'FieldNoteApp';
const DB_VERSION = 2;
const OVERLAY_STORE = 'overlays';
const GROUP_STORE = 'overlay-groups';

export interface StoredOverlay {
  id: string;
  filename: string;
  data: ArrayBuffer;
  opacity: number;
  visible: boolean;
  groupId: string;
  timestamp: number;
  /** If set, overlay is loaded directly from this URL (data field is empty). */
  url?: string;
}

export interface StoredGroup {
  id: string;
  name: string;
  expanded: boolean;
  order: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion;

      // v1 → v2 migration: add overlay-groups store + new fields
      if (oldVersion < 1) {
        db.createObjectStore(OVERLAY_STORE, { keyPath: 'id' });
      }
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(GROUP_STORE)) {
          db.createObjectStore(GROUP_STORE, { keyPath: 'id' });
        }
        // Existing overlay records will get defaults when read
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Normalize legacy records that lack visible/groupId fields */
function normalizeOverlay(record: any): StoredOverlay {
  return {
    id: record.id,
    filename: record.filename,
    data: record.data,
    opacity: record.opacity ?? 0.8,
    visible: record.visible ?? true,
    groupId: record.groupId ?? 'default',
    timestamp: record.timestamp ?? Date.now(),
    url: record.url ?? undefined,
  };
}

// ─── Overlay CRUD ───────────────────────────────────────

export async function saveOverlay(
  id: string,
  filename: string,
  data: ArrayBuffer,
  opacity: number = 0.8,
  visible: boolean = true,
  groupId: string = 'default',
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OVERLAY_STORE, 'readwrite');
    tx.objectStore(OVERLAY_STORE).put({
      id,
      filename,
      data,
      opacity,
      visible,
      groupId,
      timestamp: Date.now(),
    } satisfies StoredOverlay);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Save a URL-based overlay (no binary data stored) */
export async function saveUrlOverlay(
  id: string,
  filename: string,
  url: string,
  opacity: number = 0.8,
  visible: boolean = true,
  groupId: string = 'default',
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OVERLAY_STORE, 'readwrite');
    tx.objectStore(OVERLAY_STORE).put({
      id,
      filename,
      data: new ArrayBuffer(0),
      opacity,
      visible,
      groupId,
      timestamp: Date.now(),
      url,
    } as StoredOverlay);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAllOverlays(): Promise<StoredOverlay[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OVERLAY_STORE, 'readonly');
    const req = tx.objectStore(OVERLAY_STORE).getAll();
    req.onsuccess = () => resolve((req.result as any[]).map(normalizeOverlay));
    req.onerror = () => reject(req.error);
  });
}

export async function deleteOverlay(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OVERLAY_STORE, 'readwrite');
    tx.objectStore(OVERLAY_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateOverlayOpacity(
  id: string,
  opacity: number,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OVERLAY_STORE, 'readwrite');
    const store = tx.objectStore(OVERLAY_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        const updated = normalizeOverlay(record);
        updated.opacity = opacity;
        store.put(updated);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateOverlayVisibility(
  id: string,
  visible: boolean,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OVERLAY_STORE, 'readwrite');
    const store = tx.objectStore(OVERLAY_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        const updated = normalizeOverlay(record);
        updated.visible = visible;
        store.put(updated);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateOverlayGroup(
  id: string,
  groupId: string,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OVERLAY_STORE, 'readwrite');
    const store = tx.objectStore(OVERLAY_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        const updated = normalizeOverlay(record);
        updated.groupId = groupId;
        store.put(updated);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateOverlayFilename(
  id: string,
  filename: string,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OVERLAY_STORE, 'readwrite');
    const store = tx.objectStore(OVERLAY_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        const updated = normalizeOverlay(record);
        updated.filename = filename;
        store.put(updated);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Group CRUD ─────────────────────────────────────────

export async function saveGroup(group: StoredGroup): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GROUP_STORE, 'readwrite');
    tx.objectStore(GROUP_STORE).put(group);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAllGroups(): Promise<StoredGroup[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GROUP_STORE, 'readonly');
    const req = tx.objectStore(GROUP_STORE).getAll();
    req.onsuccess = () => {
      const groups = (req.result as StoredGroup[]).sort((a, b) => a.order - b.order);
      resolve(groups);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteGroup(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GROUP_STORE, 'readwrite');
    tx.objectStore(GROUP_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
