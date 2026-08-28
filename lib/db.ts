/**
 * FieldNoteApp IndexedDB の共有オープン処理。
 *
 * 重要: 同じDBを複数モジュールが異なるバージョンで開くと
 * VersionError になるため、バージョン管理は必ずここに一本化する。
 * ストアを追加するときは DB_VERSION を上げて onupgradeneeded に追記する。
 */

const DB_NAME = 'FieldNoteApp';
const DB_VERSION = 4;

export const OVERLAY_STORE = 'overlays';
export const GROUP_STORE = 'overlay-groups';
export const FEATURE_STORE = 'features';
export const PHOTO_STORE = 'photos';

export function openDB(): Promise<IDBDatabase> {
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
      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains(PHOTO_STORE)) {
          const store = db.createObjectStore(PHOTO_STORE, { keyPath: 'id' });
          store.createIndex('featureId', 'featureId', { unique: false });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
