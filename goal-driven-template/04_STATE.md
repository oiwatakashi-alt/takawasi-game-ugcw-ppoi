# STATE(状態台帳) — セッションを跨いで生き残る唯一のファイル

docsは「決定」、gitは「事実」、このファイルは「現在」。毎ターン末に更新し、
新セッションはまずここを読む(session_brief.shが全文を注入する)。

更新規則: 「現在地」「予算カウンタ」は**欄の置換**で更新する(追記禁止。追記式に
すると数週間で嘘の台帳になる)。追記してよいのは発見/驚き/決定ログ/負の知識のみ。
鮮度の保証は偵察番のgit log照合が行う——ここが事実と食い違っていたらgit側が正しい。

## 現在地

- フェーズ: LUNA単騎のコア判定付き個人公開(UI再編再計画: 2026-07-10)
- 現マイルストーン: local screenshot QA完了・個人VPS staging待ち
- 直前に完了したこと: Battle警報レールとAfter Actionの数値階層を再編し、Theater→Camp→Deployment→Battle→After Action→第6戦略ターンCampを再走。console error 0、broken image 0、overflowなしを確認
- 次の一手: 個人VPSの既存ローカルSSH経路の認証状態が戻るまで、SHA別release preflightを維持する。復旧後にrelease/vhost/nginx/live QA/rollbackを実行する。戦術mapへの画像追加は保留
- ブロッカー: TCP/22は到達するが既存ローカルSSH経路がauth_denied。HTTPSは404、release/vhost/reloadは未実行。証跡: `outputs/takawasi-vps-deploy-blocked-2026-07-10.md` / `outputs/takawasi-vps-preflight-3a4bc68.json`

## 予算カウンタ

以下の行は `tools/check.sh` が読む。行頭の書式(「- テスト数: 」等)を崩さず、数値は半角で書く。

- このフェーズの消費ターン: 10 / 目安12
- 同一失敗カウント: VPS SSH Connection refused: 2回(3回で停止して報告)。最新read-only再確認: TCP/22 open後にauth_denied 1回
- テスト数: 0(自動回帰test scriptなし。既存JSON QA reportは証跡でありテスト数に数えない)
- 現在ウェーブ: 005_local screenshot QA完了・VPS staging待ち(開始: 2026-07-10。計画は01_PLANのM3項目)
- 完了ウェーブ数(前回再計画から): 0 / 再計画トリガー5
- 総ターン上限: なし
- 期限: なし

## 仮定(検証されていない前提)

- 現行の半自律戦術コアは製品品質まで仕上げられる / 2026-07-10 / 崩れたら現方式の機能・content量産を止め、方式転換が必要
- 既存 `outputs/` の個別QAは過去時点の再現証拠として使える / 2026-07-10 / 崩れたら現フェーズの一周証跡で全面再取得が必要
- Vite static buildは個人VPSのnginx配下でlocal-first機能を同等に実行できる / 2026-07-10 / 崩れたらbase path・SPA fallback・storage挙動をM3で修復

## 未解決の問い

- 現行コアループは制作適合性の異なる代替方式より完成可能性が高いか / M4 LUNA直列3視点レビュー
- 実際に一周した人間が「もう一度遊びたい」と感じるか / M5 人間チェックポイント

## 発見リスト(範囲外の気づき。実行しない、積むだけ)

- `package.json` に自動回帰test scriptがなく、検証の主軸がbuild+個別browser QAに偏っている / 通常(現フェーズでは修正せず候補置き場)
- command issue plan/advisor/compliance/partial executionは最新FILEMAP上でbuild-verified/browser-unverified / 通常
- `npm run build`はmain JS約754 kBのchunk警告を出す / 通常
- `README.md` のprototype表記と2026-06-30高位planが2026-07の実装規模に追いついていない / 通常

## 驚きと想定外(Surprises & Discoveries)

想定と違った挙動・構造。次フェーズの計画とpremortemの材料になる。
- 2026-07-10 / `src/` 182ファイル・9 screen・206 JSON QA reportsまで実装が進んでいる一方、効果判定と自動回帰基盤は台帳化されていなかった
- 2026-07-10 / local `origin` は存在しない `takawasi` ownerを向いていたが、実SSH identityは `oiwatakashi-alt` で、同名の既存個人repoがmainを保持していた
- 2026-07-10 / `game.takawasi-social.com` は個人VPSへ解決しTLS応答するが、専用nginx vhostがなく現在404。新規DNS作業は不要でvhost+release treeが未着手部分
- 2026-07-10 / スクリーンショット再読でCamp旅団カードとDeployment配置枠がintrinsic widthで中央面から横にはみ出し、Battle主戦場mapがDOM上4,400px下に埋もれていた。画像不足より先に情報階層を修復する必要がある
- 2026-07-10 / 戦略map背景は中央余白を表示すると効果が弱かったため、Theater左パネルの地形端部を背景位置へ調整。画像を濃くして情報カードを潰すのではなく、位置と低不透明度で視覚アンカーを作る必要がある
- 2026-07-10 / After Actionの損耗カードは情報を削るより、部隊名と数値詳細の2列へ分けるだけで同じ義務情報を短い縦高にできた。Battle警報も個別カードのままではなくレール境界でまとまりを示せた

## 決定ログ(Decision Log)

迷って選んだこと。往復(オシレーション)防止用。同じ議題を再度迷い始めたらここを先に読む。
- 2026-07-10 / v2.7.1移行後の最初のフェーズは新機能でなくコア方式再審査 / 最初のplayable後に方式を再審査していないため / 人間判定で現方式続行が採択されたら次フェーズへ
- 2026-07-10 / regression基盤・browser未検証・bundle警告・docs同期は候補置き場 / 今回は移行だけというユーザー境界を守るため / コア判定後に価値順で昇格
- 2026-07-10 / この個人repoでは全工程をLUNA直営としDeepSeek/DS/CCDS/Claude等へ委譲しない / ユーザーのモデル固定指示と会社用custom instructionの誤適用を防ぐため / 人間が明示変更するまで継続
- 2026-07-10 / 新規GitHub repoを作らず既存 `oiwatakashi-alt/takawasi-game-ugcw-ppoi` を正とする / SSH identityとremote mainをread-only確認できたため / repoの不一致が実証された場合だけ再検討
- 2026-07-10 / 個人公開先は `game.takawasi-social.com` としgit SHA別release+`current` symlinkで展開 / DNS・TLS・nginx・配置親をread-only確認済みでrollback可能にするため / M3 live QA失敗時は旧releaseへ戻す
- 2026-07-10 / MISSION変更監査 / `05e8fc1` のLUNA固定・個人GitHub/VPS・会社資産不使用はユーザー指示と変更記録に一致し、M2 local QAへ継続 / 監査 / 不一致が確認された場合は境界を再停止
- 2026-07-10 / MISSION計器 / 承認済みMISSION変更を後続の明示的な`[監査] ... MISSION ...` commitでackし、その後は赤を再発させない / 赤の反復を止めて製品QAへ戻るため / 新しいMISSION変更は後続監査がない限り赤
- 2026-07-10 / M2判定 / 技術的な一周導線・console error 0・broken image 0・後続画面への結果持越しを受入。Battleの戦線崩壊はゲームプレイ結果として証跡に残し、成功へ書き換えずM3へ進む / M2受入は導線QAであり、現方式の市場/再戦価値はM4/M5で判定
- 2026-07-10 / M3停止境界 / GitHub反映とlocal buildは緑だが、VPS SSH port 22が拒否されたためremote mutationを実行しない / host verification・秘密迂回・空の200を避けるため / SSH到達性と既存releaseをread-only再確認できたら再開
- 2026-07-10 / M3再確認 / 09:35のread-only SSH再試行もConnection refused。remote mutationなし / 同一失敗3回までは安全な再確認、3回到達後は人間へ返上
- 2026-07-10 / UI再編優先 / VPSはSSH Connection refusedのままなのでremote mutationを止め、ユーザー指示に従いlocal screenshot-led reorgを先行 / 画像生成は骨格安定後の局所補強へ限定
- 2026-07-10 / 画像補強境界 / 戦略mapのみversioned rasterを採用し、戦術mapは既存token・線・objectiveの密度を再評価してから追加判断 / UI文字や義務情報を生成画像へ置換しない
- 2026-07-10 / UIウェーブ2完了 / Battle警報とAfter Actionの再撮影差分が受入を満たしたため、UIコード作業を一旦閉じ、VPS stagingゲートへ戻す / SSH拒否が解消するまではremote mutationをしない
- 2026-07-10 / M3再確認3 / TCP/22はopenになったが既存ローカルSSH経路はauth_denied。認証情報の推測・別鍵・別ユーザー・host verification回避はせず、local release preflightだけを記録 / 認証状態が復旧したら同じSHAで再開

## 見つからなかったもの(負の知識)

探して無かったもの・棄却した案。再走防止用。
- backend/API/DB経路は存在しない。現行はversioned localStorage providerのlocal-first browser game
- 自動回帰test scriptは見つからなかった。`npm run build`は型検査+bundleであり挙動testではない
- GitHubの `takawasi/takawasi-game-ugcw-ppoi` は見つからずpush不能。既存個人repoは `oiwatakashi-alt/takawasi-game-ugcw-ppoi`
- `game.takawasi-social.com` 専用nginx server blockと `/var/www/subdomains/game` release treeは2026-07-10時点で未作成
