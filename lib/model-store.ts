/**
 * ノート添付3Dモデル（GLB / glTF）のIndexedDB永続化。
 *
 * Scaniverse等でスキャンしたモデルをノートに添付し、
 * モデル表面のクリック位置にアノテーション（番号付きの所見）を残せる。
 */

import { openDB, MODEL_STORE } from './db';

/** モデル表面の一点に紐づく所見 */
export interface ModelAnnotation {
  id: string;
  /** モデルローカル座標 [x, y, z] */
  position: [number, number, number];
  title: string;
  description: string;
  createdAt: number;
}

export interface StoredModel {
  id: string;
  featureId: string;
  /** 元ファイル名（拡張子なし） */
  name: string;
  blob: Blob;
  annotations: ModelAnnotation[];
  createdAt: number;
}

export async function saveModel(model: StoredModel): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MODEL_STORE, 'readwrite');
    tx.objectStore(MODEL_STORE).put(model);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadModelsForFeature(featureId: string): Promise<StoredModel[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MODEL_STORE, 'readonly');
    const req = tx.objectStore(MODEL_STORE).index('featureId').getAll(featureId);
    req.onsuccess = () => {
      const models = (req.result as StoredModel[]).sort((a, b) => a.createdAt - b.createdAt);
      resolve(models.map((m) => ({ ...m, annotations: m.annotations ?? [] })));
    };
    req.onerror = () => reject(req.error);
  });
}

/** アノテーションだけを差し替える（モデル本体は再書き込みしない） */
export async function updateModelAnnotations(
  id: string,
  annotations: ModelAnnotation[],
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MODEL_STORE, 'readwrite');
    const store = tx.objectStore(MODEL_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result as StoredModel | undefined;
      if (record) store.put({ ...record, annotations });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteModel(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MODEL_STORE, 'readwrite');
    tx.objectStore(MODEL_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteModelsForFeature(featureId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MODEL_STORE, 'readwrite');
    const store = tx.objectStore(MODEL_STORE);
    const req = store.index('featureId').getAllKeys(featureId);
    req.onsuccess = () => {
      for (const key of req.result) store.delete(key);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** ノートIDごとの「モデル数」と「アノテーション総数」（一覧表示用） */
export async function loadModelCounts(): Promise<Record<string, { models: number; annotations: number }>> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MODEL_STORE, 'readonly');
    const req = tx.objectStore(MODEL_STORE).getAll();
    req.onsuccess = () => {
      const counts: Record<string, { models: number; annotations: number }> = {};
      for (const m of req.result as StoredModel[]) {
        const entry = counts[m.featureId] ?? { models: 0, annotations: 0 };
        entry.models += 1;
        entry.annotations += m.annotations?.length ?? 0;
        counts[m.featureId] = entry;
      }
      resolve(counts);
    };
    req.onerror = () => reject(req.error);
  });
}
