# M4/M5 人間検収パック

## 状態

- M4: 比較表とLUNA直列レビュー完了
- M5: 人間判定待ち。未判定のままフェーズ完了にはしない
- 実行モデル: Codex LUNA (`gpt-5.6-luna`)のみ。外部AIモデル委譲なし

## 起動即デモ

1. `npm ci`
2. `npm run dev -- --host 127.0.0.1`
3. desktop browserで`http://127.0.0.1:5173/`を開く。初期化後、Theaterの「幕舎で準備する」→Campの「出撃配置へ」→Deploymentの「選抜部隊で戦闘開始」→Battleを3倍速で完了→「戦果報告へ」→After Actionの「結果を反映して幕舎へ」を操作する。
4. 公開確認は`https://game.takawasi-social.com/`で同じ導線を再現する。

## 証跡

- local UI: `outputs/ui-reorg/qa-report-v5.json` / `outputs/ui-reorg/repro-v5.md`
- VPS deployment/live (current): `outputs/takawasi-vps-deploy-f058545.json` / `outputs/takawasi-vps-live-f058545-*.png`
- VPS deployment/live (historical): `outputs/takawasi-vps-deploy-1ce85dd.json` / `outputs/takawasi-vps-live-*.png`
- UI review lens: `outputs/ui-reorg/screenshot-review-lens-v1.md`
- 比較: `outputs/m4-comparison-2026-07-10.md`
- 三窓: `hub/reports/from-codex/m4-macro-review-2026-07-10.md`、`m4-micro-review-2026-07-10.md`、`m4-market-review-2026-07-10.md`
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

## 人間記入欄

- 判定: `[未判定]`
- 理由: `[人間が記入]`
- 条件付き続行の条件: `[該当時に記入]`
- 実操作で最も再戦したくなった判断: `[人間が記入]`
- 実操作で最も説明不足だった判断: `[人間が記入]`
