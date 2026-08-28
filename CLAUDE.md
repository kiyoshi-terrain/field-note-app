# Field Note App

## プロジェクト概要
フィールドGISアプリ。Avenza Maps + 描画機能のイメージ。
オフライン地図上でGPS位置取得・描画・データ保存ができる現場調査ツール。

## ロードマップ

### Phase 1: 基盤（地図 + 位置）
1. ✅ 地図表示（MapLibre GL JS + OSMラスタータイル）
2. ✅ GPS位置取得 + 現在地表示
3. ✅ PMTilesオフラインタイル対応（ローカル/URLラスターオーバーレイ + レイヤー管理パネル）

### Phase 2: データ作成
4. ✅ Terra Drawによる描画ツール（ポイント・ライン・ポリゴン）※Web版
5. ✅ Waypoint配置（名前・説明・色）※写真はPhase 4
6. ✅ GPSトラック記録（距離・時間統計）※標高統計は未対応

### Phase 3: データ管理
7. 🔶 GeoPackageへの保存（未対応 — 現状はIndexedDB永続化 + GeoJSON/GPXで代替）
8. ✅ GeoJSON / GPXインポート・エクスポート
9. ✅ 計測表示（ライン距離・ポリゴン面積/周囲長をノート一覧に自動表示）※単体の計測モードは未実装

### Phase 4: フィールド向け強化
10. ✅ Waypoint写真撮影（カメラ・フォトライブラリ添付、IndexedDB保存）※Web版・全ノート種別対応
11. 🔶 座標・コンパスオーバーレイ表示（座標バーは実装済み）
12. 🔶 ダークアウトドアテーマ（フォレストグリーン + アンバー）

### 補足
- 描画・ノート機能はWeb版のみ。Native（WebView地図）はオーバーレイ・ハザード・描画が未実装のno-opスタブ。
- ハザードレイヤー（MLIT 不動産情報ライブラリ、Geoloniaプロキシ経由）を追加実装済み。

## 技術スタック
- Expo SDK 54 + React Native 0.81.5 + TypeScript
- expo-router 6（ファイルベースルーティング）
- MapLibre GL JS — WebView経由（Native）/ 直接レンダリング（Web）
- react-native-webview — Native側の地図表示
- maplibre-gl npm — Web側の地図表示

## アーキテクチャ

### プラットフォーム別ファイル解決
Expoの拡張子ベース自動解決を使用：
- `MapView.tsx` → iOS/Android（WebViewでMapLibre HTML）
- `MapView.web.tsx` → Web（maplibre-gl直接レンダリング）

### ディレクトリ構成
```
app/
  _layout.tsx          ルートレイアウト（headerなしStack）
  index.tsx            メイン画面（地図フルスクリーン + 全UI配線）
components/
  map/
    map-html.ts        MapLibre GL JS HTMLテンプレート生成
    MapView.tsx        Native用地図コンポーネント（描画等はno-op）
    MapView.web.tsx    Web用地図コンポーネント（Terra Draw統合）
    types.ts           MapViewHandle / DrawMode / Overlay型定義
  notes/
    DrawToolbar.tsx    描画・トラック記録・ノート一覧ツールバー
    NotePanel.tsx      ノート一覧パネル（計測値表示・入出力）
    NoteEditDialog.tsx ノート名・説明・色の入力ダイアログ
hooks/
  use-location.ts      GPS位置取得フック
  use-track-recorder.ts GPSトラック記録フック
lib/
  db.ts                IndexedDB共有オープン処理（バージョン管理はここに一本化）
  overlay-store.ts     PMTilesオーバーレイのIndexedDB永続化
  feature-store.ts     フィールドノートのIndexedDB永続化
  photo-store.ts       ノート添付写真の保存と画像圧縮
  feature-io.ts        GeoJSON / GPX 入出力
  geo-utils.ts         距離・面積・方位計算とフォーマッタ
  hazard-layers.ts     MLITハザードレイヤー定義
```

### React Native ↔ MapLibre 通信
- Native→Map: `webViewRef.current.injectJavaScript()`
- Map→Native: `window.ReactNativeWebView.postMessage()` → `onMessage`
- Web: maplibre-glインスタンスを直接操作

## 対象プラットフォーム
- iOS（iPhone / iPad + Safari）
- Android（タブレット / スマホ + Chrome）
- Web（Expo web — 開発・プレビュー用）

## コーディング規約
- TypeScript strict mode
- パスエイリアス: `@/*` → `./*`
- コンポーネントはdefault export
- プラットフォーム固有コードは `.web.tsx` / `.tsx` で分離

## 開発・実行
```bash
npx expo start --web    # Webプレビュー
npx expo start          # モバイル（Expo Go）
```
