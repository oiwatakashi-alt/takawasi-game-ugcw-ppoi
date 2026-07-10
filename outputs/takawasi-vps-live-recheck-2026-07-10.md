# Personal VPS live recheck — 2026-07-10

## Scope

- URL: `https://game.takawasi-social.com/`
- Release under test: `f058545e6597b5c966184b9198320a3627677f5b` (current)
- Route/state: Theater, 第3戦略ターン, 東方辺境防衛線防衛戦
- Target viewport: 1280x720
- Actual CSS viewport: 1280x720
- Screenshot: current in-app browser viewport, 1280x720

## Runtime result

- `console error`: 0
- `broken images`: 0
- `document.scrollWidth`: 1280
- `innerWidth`: 1280
- `horizontal overflow`: false
- 主戦場: `主戦場` / `スキップ不可` present
- Theater primary action: `幕舎で準備する`, top 304px, bottom 344px, first viewport visible
- `npm run build`: pass (`tsc -b` + Vite build; existing main bundle warning only)

## Screenshot-based area observation

- 画面の主作業面は中央の今ターン主戦場で、主操作は上端へ戻っている。
- 右側小任務カードは4枚とも幅341pxで、DOM上の高さは803px / 840px / 813px / 809px。画面を横に切らないが、補助情報列は縦に長い。
- 判定: 技術QAは緑。右欄の要約→詳細分離はUI観点上の黄候補として記録する。ただしM5人間判定前のため、ここで新しいUI仕様や方式選択を確定しない。

## Existing evidence connection

- Full live loop and rollback: `outputs/takawasi-vps-deploy-f058545.json` and `outputs/takawasi-vps-live-f058545-*.png`
- Review criteria: `outputs/ui-reorg/screenshot-review-lens-v1.md`
- This file is a current read-only recheck, not a replacement for the full-loop evidence.
