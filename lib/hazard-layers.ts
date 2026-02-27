/**
 * 国土交通省 不動産情報ライブラリAPI — ハザードレイヤー定義
 *
 * CORS回避のためGeoloniaの公開プロキシを経由してPBFベクトルタイルを取得する。
 * 参考: https://blog.geolonia.com/2025/04/18/mlit-estate-library-proxy-api
 */

export interface HazardLayerDef {
  /** MapLibre source/layer ID prefix (e.g. "hazard-steep-slope") */
  id: string;
  /** MLIT API endpoint code (e.g. "XKT022") */
  apiCode: string;
  /** 日本語ラベル */
  label: string;
  /** fill color */
  color: string;
  /** minimum zoom to show data */
  minzoom: number;
  /** source-layer name in the PBF tile */
  sourceLayer: string;
}

export const HAZARD_LAYERS: HazardLayerDef[] = [
  {
    id: 'hazard-steep-slope',
    apiCode: 'XKT022',
    label: '急傾斜地',
    color: '#E53E3E',
    minzoom: 10,
    sourceLayer: 'hits',
  },
  {
    id: 'hazard-landslide',
    apiCode: 'XKT021',
    label: '地すべり',
    color: '#DD6B20',
    minzoom: 10,
    sourceLayer: 'hits',
  },
  {
    id: 'hazard-liquefaction',
    apiCode: 'XKT025',
    label: '液状化',
    color: '#805AD5',
    minzoom: 10,
    sourceLayer: 'hits',
  },
  {
    id: 'hazard-disaster-risk',
    apiCode: 'XKT016',
    label: '災害危険',
    color: '#9B2C2C',
    minzoom: 10,
    sourceLayer: 'hits',
  },
  {
    id: 'hazard-fill-land',
    apiCode: 'XKT020',
    label: '盛土造成地',
    color: '#975A16',
    minzoom: 10,
    sourceLayer: 'hits',
  },
];

/**
 * Geolonia CORS proxy for MLIT API.
 * Adds API key server-side & returns CORS-enabled PBF tiles.
 */
export const PROXY_BASE_URL = 'https://du6jhqfvlioa4.cloudfront.net';

/** Build the tile URL for a given hazard layer */
export function hazardTileUrl(apiCode: string): string {
  return `${PROXY_BASE_URL}/ex-api/external/${apiCode}/{z}/{x}/{y}.pbf`;
}
