# Field Note App

## プロジェクト概要
フィールドGISアプリ。Avenza Maps + 描画機能のイメージ。
オフライン地図上でGPS位置取得・描画・データ保存ができる現場調査ツール。

## ロードマップ

### Phase 1: 基盤（地図 + 位置）
1. ✅ 地図表示（MapLibre GL JS + OSMラスタータイル）
2. ✅ GPS位置取得 + 現在地表示
3. 🔶 PMTilesオフラインタイル対応

### Phase 2: データ作成
4. 🔶 Terra Drawによる描画ツール（ポイント・ライン・ポリゴン）
5. 🔶 Waypoint配置（名前・説明・写真・色）
6. 🔶 GPSトラック記録（距離・時間・標高統計）

### Phase 3: データ管理
7. 🔶 GeoPackageへの保存
8. 🔶 GeoJSON / GPXインポート・エクスポート
9. 🔶 距離・方位計測ツール

### Phase 4: フィールド向け強化
10. 🔶 Waypoint写真撮影（カメラ連携）
11. 🔶 座標・コンパスオーバーレイ表示
12. 🔶 ダークアウトドアテーマ（フォレストグリーン + アンバー）

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
  index.tsx            メイン画面（地図フルスクリーン）
components/
  map/
    map-html.ts        MapLibre GL JS HTMLテンプレート生成
    MapView.tsx        Native用地図コンポーネント
    MapView.web.tsx    Web用地図コンポーネント
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
