/**
 * 地理計算ユーティリティ（距離・面積・フォーマット）
 * WGS84近似のハバーサイン距離と球面多角形面積を使用。
 */

const EARTH_RADIUS_M = 6371008.8;

export type Position = [number, number]; // [lng, lat]

/** 2点間のハバーサイン距離（メートル） */
export function haversineDistance(a: Position, b: Position): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const dφ = ((lat2 - lat1) * Math.PI) / 180;
  const dλ = ((lng2 - lng1) * Math.PI) / 180;

  const h =
    Math.sin(dφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** ライン全長（メートル） */
export function lineLength(coords: Position[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineDistance(coords[i - 1], coords[i]);
  }
  return total;
}

/**
 * 球面多角形の面積（平方メートル）。
 * 外周リングのみを対象とする（穴は考慮しない）。
 */
export function polygonArea(ring: Position[]): number {
  if (ring.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[(i + 1) % ring.length];
    const λ1 = (lng1 * Math.PI) / 180;
    const λ2 = (lng2 * Math.PI) / 180;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    total += (λ2 - λ1) * (2 + Math.sin(φ1) + Math.sin(φ2));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

/** 2点間の方位角（度、0=北） */
export function bearing(a: Position, b: Position): number {
  const φ1 = (a[1] * Math.PI) / 180;
  const φ2 = (b[1] * Math.PI) / 180;
  const dλ = ((b[0] - a[0]) * Math.PI) / 180;
  const y = Math.sin(dλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  const θ = (Math.atan2(y, x) * 180) / Math.PI;
  return (θ + 360) % 360;
}

/** 距離の表示用フォーマット（m / km） */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters.toFixed(0)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

/** 面積の表示用フォーマット（m² / ha / km²） */
export function formatArea(sqMeters: number): string {
  if (sqMeters < 10000) return `${sqMeters.toFixed(0)} m²`;
  if (sqMeters < 1000000) return `${(sqMeters / 10000).toFixed(2)} ha`;
  return `${(sqMeters / 1000000).toFixed(2)} km²`;
}

/** 経過時間の表示用フォーマット（h:mm:ss） */
export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** ジオメトリ座標群から [west, south, east, north] のバウンディングボックスを計算 */
export function coordsBounds(coords: Position[]): [number, number, number, number] {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return [west, south, east, north];
}
