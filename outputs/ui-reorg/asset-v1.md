# UI再編 v1 グラフィック補強記録

## 採用素材

- 実行時ファイル: `src/assets/generated/strategic-theater-map-v1.jpg`
- 生成元PNG: `outputs/ui-reorg/strategic-theater-map-v1-source.png`
- 用途: Theaterの5層戦線パネル背景
- サイズ: 1672 x 941 JPEG / 536KB / RGB
- 実行時SHA-256: `956c4af8c4a85950edc60515976cc495b1a0896dee9e3e6255c8411486e3a81e`
- 生成元SHA-256: `29bc3c79042f003db228ba25ea66dd048283406e6fdfdbfd8f4ccc749e0cd18a`
- 適用: `.screen-host-campaign-map .map-panel` の低不透明度背景。既存カード・文字・操作DOMは変更なし

## 生成仕様

- 実行経路: Codex内蔵 image generation
- 用途分類: `stylized-concept`
- 要求: 19世紀軍用野戦map風、東方辺境の森林・河川・道路・湿地・鉄道、中央に余白、UI文字なし、旗・部隊token・透かしなし
- 目的: 5層戦線の情報面に地理的な視覚アンカーを与える。画面の義務情報を画像で置換しない

## 採否

採用。Theaterのスクリーンショットで地形の存在感が増え、カードの文字は読める。次の生成候補は戦術mapだが、戦術mapは既存の線・token・objectiveが密なため、別素材を追加する前にBattleの再撮影差分を確認する。
