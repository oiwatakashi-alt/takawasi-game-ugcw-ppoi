# ゴール文 — 現フェーズ: 条件付き続行・Scenario Pack整形とB契約準備

フェーズごとに書き直して起動する。ゴール文の仕事は「今のフェーズの完了条件を
検証可能に言うこと」だけ。柵は00_MISSION、配車と番は03_DISPATCH、計画は01_PLAN。

## 現行ゴール文

```
北極星(00_MISSION.mdから逐語で引用):
> このプロジェクトは、戦略・戦術・軍団育成・防御陣地の判断が相互に履歴を残す、製品版規模の長期戦術キャンペーンゲームを完成させるために存在する。

CodexのLUNA (`gpt-5.6-luna`) だけを使い、01_PLAN.mdの「条件付き続行・Scenario Pack整形とB契約準備」を完了する。
DeepSeek、DS V4、CCDS、Claude、Grok、TBA、その他AIモデルへ委譲しない。会社GitHub/AWS/Medixusは使わない。
毎ターン必ず: (1)bash goal-driven-template/tools/session_brief.sh を実行する(状態・計器・配車結果・現在番の
規則が注入される) (2)配車結果を引用して番を宣言する (3)注入された規則だけで働く
(4)commitして04_STATE.mdを欄置換で更新し、完了報告を08_LOG.mdに追記する
(5)bash goal-driven-template/tools/turn_close.sh で契約を機械検査する(赤はamend)。

完了条件:
- local originが個人GitHub `oiwatakashi-alt/takawasi-game-ugcw-ppoi` を向き、全移行commitがmainへpushされている
- 現行コアループをdesktopで Theater→Camp→Deployment→Battle→After Action→次ターンまで実操作し、短い録画または操作ログ・再現手順・各判断の後続影響が `outputs/` にある
- `dist/`が個人VPS `/var/www/subdomains/game/releases/<git-sha>/` へversioned配置され、`current` symlinkと専用nginx vhostで `https://game.takawasi-social.com/` に公開されている。旧releaseを残し、`nginx -t`・Takawasi Game固有内容のrendered smoke・live desktop一周QA・rollback検証が成功している
- 現行方式を含む制作適合性の異なる最低3案が、制作適合性・市場層・楽しさ・受入の機械検証可能率・全損costで比較され、既存実装量を続行理由に使っていない
- LUNAがマクロ→ミクロ→市場の順に文脈を分けて直列レビューし、同一モデル代替と各指摘の採用/棄却+理由が台帳化されている
- 人間が実操作証跡と比較表を見て「もう一度遊びたい/条件付き続行/方式転換」を判定し、理由が照合ログとSTATE決定ログにある
- `npm run build`、`git diff --check`、`bash goal-driven-template/tools/check.sh`が成功し、対象実機QAでconsole error 0・broken image 0
- 検収パック(01_PLAN.mdの人間チェックポイント節)を提出済み
- `src/content/scenarioTypes.ts`のschema validator、`src/content/templates/scenarioPackTemplate.ts`の作成入口、`docs/content/SCENARIO_AUTHORING.md`、`docs/content/SCENARIO_PACK_TEMPLATE.md`が揃っている
- `border-emergency-001`がテンプレートから作成され、主戦場非auto-resolve・小作戦auto-resolve・戦果持越しの境界validatorが起動時に通る
- 方式BのBattle/save/replay契約、右欄summary/detail、初回説明導線、Scenario Pack起点のlocal QAが緑になる
- humanopsのM5起票は人間の`条件付き続行`判定を受けてdoneへ移されている

規律:
- 検証が失敗したら先に進まず修復する
- 「やらないこと」(テンプレート受入前のcontent量産、balance調整、DLC量産、dependency/backend/AWS/会社資産/外部AIモデル委譲/無関係な個別バグ修正)には触れない。Scenario Packの型・validator・初期設定1件・B契約の入口は現フェーズの対象とする
- `/Users/oiwa/Desktop/接続情報.md` の内容、password、token、API key、private keyをrepo・ログ・回答へ出さない。認証は既存ローカルSSH設定だけを使う
- フェーズ予算8ターンを超えたら監査番に入り、続行/分割/返上を判断して報告する
- 人間専任の操作(課金・認証・契約・行政等)はhub/humanops/README.mdの梯子を踏む。
  起票は棚上げであって停止ではない
- 停止条件は00_MISSIONの停止条件節に従う(同一失敗3回/不可逆操作/全候補人間待ち/撤退条件)。
  停止・完了を申告するターンは bash goal-driven-template/tools/stop_check.sh を実行し、棚卸しをLOGに引用する
  (「もう残っていない」は主張でなく機械の棚卸しで示す)
```

書き方の規則:
- 「〜し続ける」「〜を改善する」を禁止。外から達成判定できる状態で書く
- 完了条件を**緩める**方向の書き換えは人間承認のみ(00_MISSIONのラチェット)。締める方向は自由+記録
- 完了条件は機構の緑(動いた)でなく**成果の緑(使われた・目的に効いた)まで**書く。
  機構グリーンだけの完了条件は、自己参照の増築を高速で正当化する(根拠: CHANGELOG v2.0)
- **完成の閾値は07_KNOWLEDGEの能力台帳と突合して設定する**。「動けばMVP完了」に
  切り下げてよいのは、それ以上の検証が能力制約で不可能なことの実証(プローブ失敗か
  台帳の負の知識)がある場合のみ。訓練知識由来の「できない」で閾値を下げない
  (根拠: CHANGELOG v2.1)
- 目標1つ・停止条件1まとまり。雑多な作業の寄せ集めをゴールにしない

## Codex で起動(as-of 2026-07。バージョン依存の記述は公式docsを優先)

有効化(初回のみ): `~/.codex/config.toml` に `[features]` `goals = true`、または `/experimental`。
起動: 上の雛形を `/goal ` に続けて貼る。
確認 `/goal` / 一時停止 `/goal pause` / 再開 `/goal resume` / 解除 `/goal clear`。
前提: Gitリポジトリ内で実行。無人度は sandbox(workspace-write推奨)×approval。

## Claude Codeでの起動は禁止(このプロジェクト固有)

Claude系でこのrepoを開いた場合は実装・レビュー・Git操作を開始せず、CodexアプリでLUNAを選んだ別セッションへ戻す。`/goal`は上記のCodex用ゴール文だけを使う。

## 人間不在時の既定動作(00_MISSIONの運転嗜好に従う)

- **fail-stop設定**: フェーズ完了後、検収が来ないうちは次フェーズに進まない。
  待機中に許されるのは発見リストの調査のみ
- **継続設定**: 次の候補(01_PLANのマイルストーン・候補置き場・発見リスト)がある限り、
  過剰にならない範囲でループを継続する。フェーズ遷移は儀式を実行し、次フェーズ計画を
  **[下書き]タグ付き**で進める——採否は次の人間チェックポイントで遡って確定する。
  停止するのは00_MISSIONの停止条件のみ。**バッチ・フェーズ境界で継続の許可を求めない**
  (報告のみ。「進めてよければ続けます」は答えが行動を変えない質問=割り込み資源の浪費)。
  候補が枯れて見えたら停止でなく軸生成工程(03_DISPATCH)へ
- どちらの設定でも: 完了条件を緩める変更は人間承認のみ(ラチェット不変)

## 停止後の儀式(次フェーズへの遷移)

1. 検収パックの証跡で01_PLAN.mdの問いに答え、証跡で判断できない問いだけ自分で触って判定
2. 判定を照合ログへ。驚き・決定は04_STATE.mdの該当欄からPLANへ昇格
3. 北極星照合と削除候補の指名(03_DISPATCH監査番の規則4・5)を実行した記録を残す。
   あわせて**三窓レビュー盤**(05_CONTRACTS——マクロ/ミクロ/市場)を起動し、
   指摘ごとの採否+理由を台帳に記録する(助言扱い・黙殺禁止)。
   ブリーフ実体は hub/briefs/review_{macro,micro,market}.md の{ }を埋めて渡す。
   **最初のプレイアブル/MVP(コアループ1周が動く最初の状態)直後の境界では、
   01_PLANコア方式ゲートの再審査を必ず含める**——続行が結論でも、代替案比較と
   判定理由を記録する(暗黙の続行がコアを確定事項化する。根拠: CHANGELOG v2.7)
4. user/drop/の未処理をトリアージしてから、次フェーズのマイルストーン+premortemを書く
   (下書きはエージェント。採否は人間——継続設定では[下書き]タグで先に進んでよい)
5. このファイルを書き直して再起動(北極星の逐語引用を忘れない)
