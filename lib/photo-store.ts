/**
 * ノート添付写真のIndexedDB永続化と画像圧縮ユーティリティ。
 * 写真はJPEGに縮小圧縮して 'photos' ストアに保存する（featureIdで紐付け）。
 */

import { openDB, PHOTO_STORE } from './db';

export interface StoredPhoto {
  id: string;
  featureId: string;
  blob: Blob;
  createdAt: number;
}

/** 長辺maxDim px・JPEG品質qualityに縮小圧縮する（EXIF回転はブラウザのデコードで適用済み） */
export async function compressImage(
  file: Blob,
  maxDim = 1600,
  quality = 0.8,
): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to decode image'));
      el.src = url;
    });

    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    return blob ?? file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function savePhoto(photo: StoredPhoto): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readwrite');
    tx.objectStore(PHOTO_STORE).put(photo);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadPhotosForFeature(featureId: string): Promise<StoredPhoto[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readonly');
    const req = tx.objectStore(PHOTO_STORE).index('featureId').getAll(featureId);
    req.onsuccess = () => {
      const photos = (req.result as StoredPhoto[]).sort((a, b) => a.createdAt - b.createdAt);
      resolve(photos);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readwrite');
    tx.objectStore(PHOTO_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deletePhotosForFeature(featureId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readwrite');
    const store = tx.objectStore(PHOTO_STORE);
    const req = store.index('featureId').getAllKeys(featureId);
    req.onsuccess = () => {
      for (const key of req.result) store.delete(key);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** ノートIDごとの写真枚数（一覧表示用） */
export async function loadPhotoCounts(): Promise<Record<string, number>> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readonly');
    const req = tx.objectStore(PHOTO_STORE).getAll();
    req.onsuccess = () => {
      const counts: Record<string, number> = {};
      for (const photo of req.result as StoredPhoto[]) {
        counts[photo.featureId] = (counts[photo.featureId] ?? 0) + 1;
      }
      resolve(counts);
    };
    req.onerror = () => reject(req.error);
  });
}
