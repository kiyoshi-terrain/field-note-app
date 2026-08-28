/**
 * フィールドノートの GeoJSON / GPX 入出力。
 * Web専用（Blobダウンロード・DOMParserを使用）。
 */

import type { NoteFeature, NoteFeatureType, NoteGeometry } from './feature-store';

// ─── Export ─────────────────────────────────────────────

/** 全ノートをGeoJSON FeatureCollection文字列に変換（写真は枚数のみ記録） */
export function featuresToGeoJSON(
  features: NoteFeature[],
  photoCounts: Record<string, number> = {},
): string {
  const collection = {
    type: 'FeatureCollection',
    features: features.map((f) => ({
      type: 'Feature',
      id: f.id,
      geometry: f.geometry,
      properties: {
        name: f.name,
        description: f.description,
        color: f.color,
        noteType: f.type,
        createdAt: new Date(f.createdAt).toISOString(),
        ...((photoCounts[f.id] ?? 0) > 0 ? { photoCount: photoCounts[f.id] } : {}),
        ...(f.stats
          ? {
              distanceM: Math.round(f.stats.distanceM),
              durationMs: f.stats.durationMs,
              startTime: new Date(f.stats.startTime).toISOString(),
              endTime: new Date(f.stats.endTime).toISOString(),
            }
          : {}),
      },
    })),
  };
  return JSON.stringify(collection, null, 2);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Waypoint・ライン・トラックをGPX 1.1文字列に変換。
 * ポリゴンはGPXに対応表現がないため外周リングをトラックとして出力する。
 */
export function featuresToGPX(features: NoteFeature[]): string {
  const wpts: string[] = [];
  const trks: string[] = [];

  for (const f of features) {
    const nameXml = `<name>${escapeXml(f.name)}</name>`;
    const descXml = f.description ? `<desc>${escapeXml(f.description)}</desc>` : '';

    if (f.geometry.type === 'Point') {
      const [lng, lat] = f.geometry.coordinates;
      wpts.push(
        `  <wpt lat="${lat}" lon="${lng}">\n    ${nameXml}${descXml ? `\n    ${descXml}` : ''}\n  </wpt>`,
      );
    } else {
      const coords =
        f.geometry.type === 'LineString'
          ? f.geometry.coordinates
          : f.geometry.coordinates[0] ?? [];
      if (coords.length === 0) continue;
      const pts = coords
        .map(([lng, lat]) => `        <trkpt lat="${lat}" lon="${lng}"></trkpt>`)
        .join('\n');
      trks.push(
        `  <trk>\n    ${nameXml}${descXml ? `\n    ${descXml}` : ''}\n    <trkseg>\n${pts}\n    </trkseg>\n  </trk>`,
      );
    }
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Field Note App" xmlns="http://www.topografix.com/GPX/1/1">',
    ...wpts,
    ...trks,
    '</gpx>',
  ].join('\n');
}

/** ブラウザでファイルをダウンロードさせる */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Import ─────────────────────────────────────────────

const DEFAULT_IMPORT_COLOR = '#4285F4';

function geometryToNoteType(geometry: NoteGeometry, noteType?: string): NoteFeatureType {
  if (noteType === 'track' && geometry.type === 'LineString') return 'track';
  switch (geometry.type) {
    case 'Point':
      return 'waypoint';
    case 'LineString':
      return 'line';
    case 'Polygon':
      return 'polygon';
  }
}

function newId(prefix: string, index: number): string {
  return `${prefix}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * GeoJSON文字列をNoteFeature配列に変換。
 * Point / LineString / Polygon 以外のジオメトリはスキップする。
 */
export function parseGeoJSON(text: string): NoteFeature[] {
  const data = JSON.parse(text);
  const rawFeatures: any[] =
    data.type === 'FeatureCollection' ? data.features
    : data.type === 'Feature' ? [data]
    : [];

  const now = Date.now();
  const result: NoteFeature[] = [];

  rawFeatures.forEach((raw, i) => {
    const geom = raw?.geometry;
    if (!geom || !['Point', 'LineString', 'Polygon'].includes(geom.type)) return;

    const props = raw.properties ?? {};
    const type = geometryToNoteType(geom as NoteGeometry, props.noteType);
    result.push({
      id: newId('import', i),
      type,
      name: String(props.name ?? props.title ?? `インポート ${i + 1}`),
      description: String(props.description ?? props.desc ?? ''),
      color: typeof props.color === 'string' ? props.color : DEFAULT_IMPORT_COLOR,
      geometry: geom as NoteGeometry,
      createdAt: now,
      updatedAt: now,
    });
  });

  return result;
}

/** GPX文字列をNoteFeature配列に変換（wpt → waypoint, trk/rte → line） */
export function parseGPX(text: string): NoteFeature[] {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid GPX file');
  }

  const now = Date.now();
  const result: NoteFeature[] = [];
  let index = 0;

  const textOf = (el: Element, tag: string): string =>
    el.getElementsByTagName(tag)[0]?.textContent?.trim() ?? '';

  for (const wpt of Array.from(doc.getElementsByTagName('wpt'))) {
    const lat = parseFloat(wpt.getAttribute('lat') ?? '');
    const lon = parseFloat(wpt.getAttribute('lon') ?? '');
    if (!isFinite(lat) || !isFinite(lon)) continue;
    result.push({
      id: newId('import', index++),
      type: 'waypoint',
      name: textOf(wpt, 'name') || `Waypoint ${index}`,
      description: textOf(wpt, 'desc'),
      color: DEFAULT_IMPORT_COLOR,
      geometry: { type: 'Point', coordinates: [lon, lat] },
      createdAt: now,
      updatedAt: now,
    });
  }

  const collectPoints = (parent: Element, ptTag: string): [number, number][] => {
    const coords: [number, number][] = [];
    for (const pt of Array.from(parent.getElementsByTagName(ptTag))) {
      const lat = parseFloat(pt.getAttribute('lat') ?? '');
      const lon = parseFloat(pt.getAttribute('lon') ?? '');
      if (isFinite(lat) && isFinite(lon)) coords.push([lon, lat]);
    }
    return coords;
  };

  for (const trk of Array.from(doc.getElementsByTagName('trk'))) {
    const coords = collectPoints(trk, 'trkpt');
    if (coords.length < 2) continue;
    result.push({
      id: newId('import', index++),
      type: 'line',
      name: textOf(trk, 'name') || `Track ${index}`,
      description: textOf(trk, 'desc'),
      color: DEFAULT_IMPORT_COLOR,
      geometry: { type: 'LineString', coordinates: coords },
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const rte of Array.from(doc.getElementsByTagName('rte'))) {
    const coords = collectPoints(rte, 'rtept');
    if (coords.length < 2) continue;
    result.push({
      id: newId('import', index++),
      type: 'line',
      name: textOf(rte, 'name') || `Route ${index}`,
      description: textOf(rte, 'desc'),
      color: DEFAULT_IMPORT_COLOR,
      geometry: { type: 'LineString', coordinates: coords },
      createdAt: now,
      updatedAt: now,
    });
  }

  return result;
}
