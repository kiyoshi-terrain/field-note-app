# Field Note App

オフライン地図上でGPS位置取得・描画・データ保存ができる現場調査ツール。
Avenza Maps + 描画機能のイメージのフィールドGISアプリです。

## 主な機能

### 地図・位置
- MapLibre GL JSによる地図表示（OSM / 地理院 淡色・航空写真・陰影起伏 / PMTilesベクター）
- GPS現在地表示（精度サークル・パルスアニメーション・座標オーバーレイバー）
- PMTilesラスターオーバーレイ（ローカルファイル / URL、グループ管理・透過度調整・IndexedDB永続化）
- ハザードレイヤー表示（急傾斜地・地すべり・液状化など、MLIT 不動産情報ライブラリ）

### フィールドノート（Web版）
- Terra Drawによる描画: Waypoint（ポイント）・ライン・ポリゴン
- 名前・説明・色を付けて保存（IndexedDBに永続化、リロード後も復元）
- GPSトラック記録（移動距離・経過時間をリアルタイム表示）
- ライン距離・ポリゴン面積/周囲長の自動計測表示
- GeoJSON / GPX エクスポート・インポート

## 開発・実行

```bash
npm install
npx expo start --web    # Webプレビュー（全機能）
npx expo start          # モバイル（Expo Go — 地図・GPSのみ）
npm run build:web       # GitHub Pages用ビルド（dist/）
```

`main`へのpushで GitHub Actions により GitHub Pages へ自動デプロイされます。

## 技術スタック

- Expo SDK 54 + React Native 0.81 + TypeScript（strict）
- expo-router 6（ファイルベースルーティング）
- MapLibre GL JS + PMTiles + Terra Draw（Web）
- react-native-webview 経由のMapLibre（iOS / Android）

アーキテクチャの詳細は [CLAUDE.md](./CLAUDE.md) を参照してください。
