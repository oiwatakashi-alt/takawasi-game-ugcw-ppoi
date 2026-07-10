# M4/M5 人間検収パック

## 状態

- M4: 比較表とLUNA直列レビュー完了
- M5: 条件付き続行。ユーザー判定を受け、方式Bの検証契約とScenario Pack整形へ進む
- 実行モデル: Codex LUNA (`gpt-5.6-luna`)のみ。外部AIモデル委譲なし

## 起動即デモ

1. `npm ci`
2. `npm run dev -- --host 127.0.0.1`
3. desktop browserで`http://127.0.0.1:5173/`を開く。初期化後、Theaterの「幕舎で準備する」→Campの「出撃配置へ」→Deploymentの「選抜部隊で戦闘開始」→Battleを3倍速で完了→「戦果報告へ」→After Actionの「結果を反映して幕舎へ」を操作する。
4. 公開確認は`https://game.takawasi-social.com/`で同じ導線を再現する。

## 証跡

- local UI: `outputs/ui-reorg/qa-report-v5.json` / `outputs/ui-reorg/repro-v5.md`
- VPS deployment/live (current): `outputs/takawasi-vps-deploy-f058545.json` / `outputs/takawasi-vps-live-qa-f058545-theater.png` / `outputs/takawasi-vps-live-f058545-*.png`
- VPS deployment/live (historical): `outputs/takawasi-vps-deploy-1ce85dd.json` / `outputs/takawasi-vps-live-*.png`
- UI review lens: `outputs/ui-reorg/screenshot-review-lens-v1.md`
- 比較: `outputs/m4-comparison-2026-07-10.md`
- 三窓: `goal-driven-template/hub/reports/from-codex/m4-macro-review-2026-07-10.md`、`goal-driven-template/hub/reports/from-codex/m4-micro-review-2026-07-10.md`、`goal-driven-template/hub/reports/from-codex/m4-market-review-2026-07-10.md`
- 採否台帳: `outputs/m4-review-ledger-2026-07-10.md`
- 保存境界probe: `outputs/m4-save-reload-probe-2026-07-10.json` / `outputs/m4-save-reload-campaign-2026-07-10.png`

## 判定ルーブリック

人間は実操作後、次の3択を1つ選ぶ。既存実装量、commit数、ファイル数は理由に使わない。

- `もう一度遊びたい`: 現行Aを続行。Bの検証契約を次waveとして昇格し、CはB後に再評価。
- `条件付き続行`: 条件を具体化し、満たすまでcontent量産を停止。候補条件は「battle save/reload」「seed/replayで同じ戦果」「戦果が次ターン戦略へ可視に残る」「初回説明導線の理解」の4つ。
- `方式転換`: 現行Aのcontent量産を停止し、BまたはCのどこへ転換するかを理由付きで指定。

## 最新公開版の確認材料

- 公開release: `f058545e6597b5c966184b9198320a3627677f5b`
- 公開URL: `https://game.takawasi-social.com/`
- 1280x720 live一周: Theater→Camp→Deployment→Battle→After Action→第3戦略ターンCamp→Theater
- UI面積: Theater主操作top304、Camp右情報面336px、Deployment右面325px、Battle主戦場map top448、After Action主操作top414
- 技術QA: console error 0、broken image 0、horizontal overflow false
- rollback: 旧releaseへ一時切替してsmoke後、f058545へ復帰してsmoke合格
- Battleは主戦場を手動操作し、3倍速と撤退操作を使った。小任務のauto-resolveには置き換えていない
- 現行live再監査: `outputs/takawasi-vps-live-recheck-2026-07-10.md`。Theater主操作top304、主戦場/スキップ不可表示、console error 0、broken image 0、horizontal overflow false
- 右欄の観測: 小任務カード4枚は幅341px、DOM上の高さ803px / 840px / 813px / 809px。切れや主操作の押し下げはないが、補助情報としてこの縦長が判断を助けたか、要約→詳細分離が必要かを人間が判定する

## 人間記入欄

- 判定: `条件付き続行`
- 理由: `コンテンツ量は一旦十分。もう一度遊びたいかは、先に整形・Scenario Packの雛形・テンプレート・初期シナリオ設定を仕上げないと判断できないため、方式Bの検証契約を条件に続行する。`
- 条件付き続行の条件: `Battle save/reload、seed/replayまたはevent/effect logによる再現性、戦果の次ターン戦略への可視化、初回説明導線の理解。コンテンツ量産はテンプレートと検証契約が緑になるまで停止する。`
- 実操作で最も再戦したくなった判断: `現時点では未判定。整形・テンプレートwave後に再評価する。`
- 実操作で最も説明不足だった判断: `現時点では未判定。初回説明導線の検証時に再評価する。`
- 右側小任務欄の評価（判断を助けた／情報過多／要約が必要）: `要約→詳細の整形後に再評価する。現状は技術的に切れていないが縦長。`
