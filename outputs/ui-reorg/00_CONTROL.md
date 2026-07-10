# Takawasi Game UI再編ループ — 2026-07-10

## 起点

`outputs/takawasi-local-loop-01-theater.png` から `06-next-turn.png` までを、local desktop 1280pxの実操作結果として再読した。

## 共通診断

- 上部の戦況・資源・直前メッセージが同じ強さで並び、現在の判断対象が一目で決まらない。
- 画面ごとの主作業面と補助情報面が分離されず、長い情報が同じ縦列へ流れ込む。
- Campは6旅団カードを横に詰めすぎ、Deploymentは設定項目を一枚の長いフォームにし、Battleは警報・目標・部隊命令・マップが同時に最大密度になる。
- After Actionは比較的読みやすいが、損耗・教訓・次ターン影響の優先順位と数値の見せ方が弱い。
- 画像不足は二次原因。まず情報階層と余白を修復し、次に主役の地形/戦線/部隊グラフィックを生成して視線誘導に使う。

## 第一ループの方針

1. 共通ヘッダーを「ターン/戦況」「主要資源」「リセット」に整理し、長いメッセージを2行以内へ制限する。
2. 各画面を主作業面・補助面・詳細面の3役へ分け、補助面はdesktopではsticky/scroll、カードは読み切れる幅にする。
3. Campは旅団カードを6列から2列へ、Deploymentは主配置面を中心に、Battleはマップと即時指揮を中心にする。
4. 各修正後に同じ画面を再撮影し、console error 0 / broken image 0 / overflowなしを再確認する。
5. 骨格が安定した後、画像生成で戦略map背景・地形帯・主戦場の視認用アセットを1系統ずつ補強する。

## 第一ループの結果

- Theater: 左=5層戦線、中央=主戦場、右=小任務へ分離。上部メッセージは2行以内へ制限。
- Camp: 中央の旅団カードを2列化し、左右の固定情報面へはみ出さないことをDOM計測で確認。
- Deployment: 主配置枠を2列化し、配置カードのintrinsic widthによる中央面の横はみ出しを抑制。
- Battle: 戦術マップをDOM上の13番目から、トップバー・戦線コマンド・警報の直後へ並べ替え。主戦場が初期viewportに現れる。
- After Action: 左=結果/損耗の意味、右=部隊別持越しの2列を維持。次ループで数値の見せ方を改善候補にする。
- 証跡: `01-theater-v1.png`〜`06-next-turn-v1.png`、`qa-report-v1.json`、`repro-v1.md`。
- 実測: local desktop 1280px、console error 0、console warning 0、broken image 0、horizontal overflow false。

## グラフィック補強 v1

- 実行時素材: `src/assets/generated/strategic-theater-map-v1.jpg`
- 生成元証跡: `outputs/ui-reorg/strategic-theater-map-v1-source.png`
- 用途: Theater左側の5層戦線map-panelの低不透明度背景。文字・カード・操作要素は既存DOMを維持。
- 生成条件: 16:9の古地図風・無文字・無UI・中央に余白を持つ戦略map背景。生成元はCodex内蔵image generation、repo内へversioned filenameでコピー。
- 判定: 画像を主役にせず、戦略map層の存在感だけを補強する。可読性が落ちた場合は不採用へ戻せる。
- 再撮影: `07-theater-map-v1.png`で左端の地形テクスチャを確認。カード文字の可読性は維持。
- 導線再検証: `08-camp-map-v1.png`〜`12-next-turn-map-v1.png`で、画像導入後も一周と結果持越しを再確認。

## 判定境界

このループではgameplay、save schema、backend、VPS展開を変更しない。UIの読みやすさ・操作順・画面密度・グラフィックの視認性だけを扱う。
