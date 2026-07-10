# STATE(状態台帳) — セッションを跨いで生き残る唯一のファイル

docsは「決定」、gitは「事実」、このファイルは「現在」。毎ターン末に更新し、
新セッションはまずここを読む(session_brief.shが全文を注入する)。

更新規則: 「現在地」「予算カウンタ」は**欄の置換**で更新する(追記禁止。追記式に
すると数週間で嘘の台帳になる)。追記してよいのは発見/驚き/決定ログ/負の知識のみ。
鮮度の保証は偵察番のgit log照合が行う——ここが事実と食い違っていたらgit側が正しい。

## 現在地

- フェーズ: LUNA単騎のコア判定付き個人公開(UI再編・個人VPS公開: 2026-07-10)
- 現マイルストーン: local/live QA・UI再編wave4・個人VPS公開・M4方式3案比較とLUNA直列レビュー完了・人間判定待ち
- 直前に完了したこと: release SHA `1ce85dd67b6a01da35288f0a61d3a9511370a00b` を92ファイルの完全一致で個人VPSへ配置し、専用vhost、`nginx -t`、reload、HTTPS rendered smokeを通過。live desktopでTheater→Camp→Deployment→Battle→After Action→第2戦略ターンCampを再走し、console error 0、broken image 0、overflowなしを確認
- 次の一手: MISSION監査commitで計器の赤を消した後、ユーザー許可に基づき`docs/deployment/PERSONAL_VPS_STATIC.md`の個人VPS再公開preflight→build→SHA release→live QAを実行する。M5の人間判定は別軸として未完了のまま保持する
- ブロッカー: M3/M4のブロッカーなし。未完了はM5人間判定と検収パックの人間記入のみ

## 予算カウンタ

以下の行は `tools/check.sh` が読む。行頭の書式(「- テスト数: 」等)を崩さず、数値は半角で書く。

- このフェーズの消費ターン: 16 / 目安18
- 同一失敗カウント: VPS SSH Connection refused: 2回(3回で停止して報告)。最新read-only再確認: TCP/22 open後にauth_denied 1回
- テスト数: 0(自動回帰test scriptなし。既存JSON QA reportは証跡でありテスト数に数えない)
- 現在ウェーブ: 012_MISSION監査緑化・個人VPS再公開実行待ち(開始: 2026-07-10。計画は01_PLANのM3/M5項目)
- 完了ウェーブ数(前回再計画から): 2 / 再計画トリガー5
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
- 2026-07-10 / `game.takawasi-social.com` は個人VPSへ解決しTLS応答する。専用vhostとSHA別release/currentを作成後、HTTPS rendered smokeとlive desktop QAまで通過
- 2026-07-10 / スクリーンショット再読でCamp旅団カードとDeployment配置枠がintrinsic widthで中央面から横にはみ出し、Battle主戦場mapがDOM上4,400px下に埋もれていた。画像不足より先に情報階層を修復する必要がある
- 2026-07-10 / 戦略map背景は中央余白を表示すると効果が弱かったため、Theater左パネルの地形端部を背景位置へ調整。画像を濃くして情報カードを潰すのではなく、位置と低不透明度で視覚アンカーを作る必要がある
- 2026-07-10 / After Actionの損耗カードは情報を削るより、部隊名と数値詳細の2列へ分けるだけで同じ義務情報を短い縦高にできた。Battle警報も個別カードのままではなくレール境界でまとまりを示せた
- 2026-07-10 / UI再編wave3でDeploymentの主要操作が長い左ペイン下部に埋まり、Battle警報6枚の右端が1280pxで切れた。画像追加ではなく操作の上端固定とdesktop幅の均等縮小で修復できた
- 2026-07-10 / UI再編wave4でAfter Actionの遷移操作が損耗一覧の下に埋まり、共通ヘッダーの直前報告もラベルなしで省略されていた。操作を結果要約の直後へ移し、報告ラベル/titleを追加して情報の入口を明示した
- 2026-07-10 / 接続情報に記載されたSSH候補のうちread-only認証できる経路を確認し、接続情報の値を証跡へ出さずM3を再開した。以前のConnection refusedは恒久障害ではなかった
- 2026-07-10 / macOS tarのAppleDouble `._*`がremote releaseへ混入し186件になった。対象releaseだけを清掃し`COPYFILE_DISABLE=1`で再投入、実ファイル92件・パス完全一致へ修復した
- 2026-07-10 / `current` symlinkの検証で通常の`find`はsymlinkを追わず0件に見える。release/current検証は`find -L`を使う必要がある
- 2026-07-10 / in-app browserを表示すると狭い表示幅でlive画面の操作ボタンが画面外になったため、live desktop QAは1280x720へ明示し、全導線を再確認した

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
- 2026-07-10 / UI再編wave3 / Deploymentの主要操作を上端へ移し、Battle警報railを1280pxで全件表示する。画像は増やさず、戦略map/戦術map分離と主戦場省略不可を維持 / 共通ヘッダーの詳細表示は次のスクショ観測へ
- 2026-07-10 / UI再編wave4 / After Actionの主要操作をファーストビューへ移し、共通ヘッダーの直前報告をラベル/title付きで表示する。local QAを閉じ、次は現行SHAのM3 preflightへ進む
- 2026-07-10 / M3公開 / 接続情報由来のread-only認証後、`1ce85dd...`をSHA別releaseへ配置し専用vhost/current/nginx reload/live QAを完了。コード同一の`16b153d...`をrollback候補として一時切替し、候補smoke後に実releaseへ復帰してsmokeを再確認 / M4の方式比較へ進む
- 2026-07-10 / 監査 / 北極星「判断が相互に履歴を残す製品版規模の長期戦術キャンペーン」へ、M3のlive一周とM4の方式判定を接続。常駐入口(AGENTS/CLAUDE/00/02)はLUNA固定・個人境界・製品版/DLC1・戦略/戦術分離で一致。削除候補: `outputs/takawasi-vps-deploy-blocked-2026-07-10.md`(M4検収後まで保留)
- 2026-07-10 / 監査抜取 / T15の`outputs/ui-reorg/qa-report-v5.json`を原本とし、`AfterActionScreen.tsx:82-86`の主要操作、`ResourceBar.tsx:16-18`の直前報告label/title、console/broken/overflow 0、carryover、scopeGuardを突合。不一致なし
- 2026-07-10 / 09_LEARNINGS刈取 / UIスクショ→DOM計測→骨格→再撮影、crop採否、密画面の3層、主操作上端、結果遷移label/titleの5行を`03_DISPATCH.md`へ統合し、全てプロジェクト限り(改訂済み)へ振り分け
- 2026-07-10 / M5証拠追加 / localStorage campaign envelopeはTheaterの第9ターンreloadを保持したが、Battle中reloadはBattle stateを保持せずTheaterへ戻った。`outputs/m4-save-reload-probe-2026-07-10.json`を人間判定の条件証拠にする。方式Bの検証契約候補として採用し、個別修正は人間判定前に行わない
- 2026-07-10 / スクショレビュー観点追加 / 右側情報欄の長さ・主作業面の占有率・縦方向の押し下げを、overflow有無と別の判定軸へ固定。今回のlocal再走では画像pixel寸法1280x720とDOM CSS viewport3878x2181が一致しないケースも観測したため、指定viewport・実CSSviewport・画像寸法を分離して記録する / `outputs/ui-reorg/screenshot-review-lens-v1.md`
- 2026-07-10 / MISSION監査 / 直近20commitの窓から前回のMISSION監査commitが外れたことで赤が再発した。`00_MISSION.md`の内容は個人LUNA固定・個人GitHub/VPS限定・会社資産/AWS/Medixus/外部AI不使用のままで、今回のユーザー許可(個人VPS/HPの変更と失敗許容)とも矛盾しない。今回の監査commitで再ackし、次番で個人VPS実行へ進む

## 見つからなかったもの(負の知識)

探して無かったもの・棄却した案。再走防止用。
- backend/API/DB経路は存在しない。現行はversioned localStorage providerのlocal-first browser game
- 自動回帰test scriptは見つからなかった。`npm run build`は型検査+bundleであり挙動testではない
- GitHubの `takawasi/takawasi-game-ugcw-ppoi` は見つからずpush不能。既存個人repoは `oiwatakashi-alt/takawasi-game-ugcw-ppoi`
- 個人VPSに存在する旧releaseはread-only preflight時点ではなく、M3 rollback rehearsalでコード同一候補を作成した。現行は新SHA releaseへ復帰済み
