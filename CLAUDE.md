# SCAPE — 開発メモ

## ビジュアルの固定ルール（変更しないこと）

- **モノクロ**：画面に出る色は ink（#1c1b1a）と paper（#f2f0ea）の 2 色だけ。カラー表示やカラーモードの切り替えを足さない。
- **ディザリング**：3D の描画は必ず `js/dither.js` のディザ（Bayer）を通す。オフにする設定を足さない。
- 調整してよいのはドットの大きさ・コントラスト・輪郭線などの「ディザの効き方」まで。

## 現在のトーン

- 「動く英字新聞」。題字・日付帯・段組み・罫線・セリフ体（Playfair Display / Libre Baskerville）。
- 3D ボードは一面の「写真（Fig. 1）」、手番の結果は `js/press.js` が書く記事（見出し＋本文）として載る。
- PC のレイアウト：左上にボード、右上にロケーション（手番の人の居場所＋最新記事）・サイコロ（専用の小さな 3D、これもディザ）・ダイスロール、下段にプレイヤー 1〜4 のボードを横並び。補給所は右から出る差し込み。
- UI の文言は英語の新聞調。ゲーム風（太い影・ドット絵フォント・ボタンだらけ）にしない。

## 構成

- `js/map.js` … マスの配置とエリア（マップエディタの db `maps/main` から書き出す。エリアごとに英語名 `label` と見た目 `terrain` を付ける）
- `js/config.js` … 地形の見た目・建物（`landmarks`）・プレイヤー・ルールのフック（`RULES`）
- `js/press.js` … 記事の文面
- `js/ledger.js` … プレイヤーボード（装備枠・バックパックのマス目・補給所・ドラッグ操作）
- `js/portraits.js` … プレイヤーボード背景の写真（`assets/portraits/`）を実行時に Bayer ディザで 2 値化。写真は必ずこれを通す
- `js/items.js` … 持ち物の挿絵（canvas で描いて Bayer ディザで 2 値化）。持ち物の種類は `CONFIG.items`
- `js/main.js` … 3D シーン・操作・ターン進行・紙面の更新
- `js/dither.js` … モノクロ・ディザのポストエフェクト
- ビルド不要。`index.html` を開けば動く（Three.js r160 は `vendor/` に同梱）

## マップエディタ（指示用）

- `tools/map-editor.html` を Artifact として公開している：https://claude.ai/artifact/7dhp3iQe2MUFbZArg6BjxR
- ユーザーがマス目・エリア（模様と自由記述の説明）を編集すると、その Artifact の db の `maps/main` に保存される。
  マップについて指示されたら `ArtifactData` の get（collection `maps`, doc_id `main`）で読んでから作業し、`js/map.js` に書き出す。
  新しいエリアが増えたら `CONFIG.terrains`・`js/textures.js` の模様・`js/press.js` の `TERRAIN_NOTES`・必要なら建物も足す。
  中身：`cols`, `rows`, `tiles[{x, y, area, n}]`（n = 進む順番、0 が START）, `areas[{id, name, pattern, notes}]`。

## 移動

- 駒は上下左右につながったマスを 1 歩ずつ進む。来たマスには戻らず、行き止まりでは引き返す。
- 分かれ道では候補のマスに印（逆さの三角）が出て、プレイヤーがクリックで選ぶ（`chooseWay`）。

## 公開と更新

- GitHub Pages（https://tatsuhiko-310.github.io/scape/）はブランチへのプッシュで自動更新される。
- Pages はファイルを最大 10 分キャッシュするので、**変更をプッシュするたびに版番号を 1 つ上げる**：
  `index.html` の `?v=N`（css / js 全部）と `<span id="build">N</span>`、`js/config.js` の写真パスの `?v=N`。
  題字上の「Ed. N」で、どの版が表示されているか確認できる。
