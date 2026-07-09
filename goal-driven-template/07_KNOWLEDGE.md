# 07_KNOWLEDGE.md — 知識台帳(リサーチの着地点+クローン着任パックの原資)

規則:
- リサーチ・市場レビュー採取の結果は、まずここに着地させてから
  ルーブリック行/UX細部台帳/マイルストーン/仕様docへ変換する(変換先を必ず書く)
- **調べる前にこのファイルを検索する**(同じ問いの再走防止)
- 状態タグ: [検証済み+ソースURL] / [証言(出どころ)] / [未検証] / [探して見つからず]
- 荷重する数値・引用は逐語で置く(パラフレーズは変異を生む)
- 古くなった項目は消さず、行頭に「(失効: 理由)」を付ける
- **ここは蒸留の台帳**: かさばる生資料(検索結果全文・フェッチ内容)は
  `hub/selfresearch/` に置き、ここには答え+状態タグ+所在だけを書く
- **環境依存の「検証済み」には検証時の起動条件を併記する**(cwd・モデル・実行環境。
  条件なしの検証済みラベルは別条件のセッションで再現せず区別がつかなくなる——
  観測済みの失敗。CHANGELOG v2.0)

## 記入形式

```
## [日付] 問い: [一行]
- 答え: [1〜3行]
- 状態: [タグ] / ソース: [URL] / ソースの実際の記述: [荷重箇所は逐語]
- 検証条件: [環境依存の場合のみ: cwd/モデル/環境]
- 着地先: [ルーブリック行 / UX細部台帳 / マイルストーン / 仕様doc / 着任パック / 負の知識]
```

## 2026-07-10 問い: どのテンプレ原本を移行したか
- 答え: `/Users/oiwa/projects/個人_takawasi/takawasiAI/goal-driven-template/` の現物69ファイルをコピーした。`CHANGELOG.md`先頭はv2.7.1で、v2.7コア方式ゲートへの画像生成境界補正を含む
- 状態: [検証済み] / ソース: local canonical folder / ソースの実際の記述: `## v2.7.1 — 2026-07-10`、`## v2.7 — 2026-07-10`
- 検証条件: cwd=`/Users/oiwa/projects/個人_takawasi/takawasi game`、`diff -rq`が移行編集前に差分0、source/targetとも69 files
- 着地先: 00_MISSION / 01_PLAN / 02_GOAL / 04_STATE / root AGENTS・CLAUDE

## 2026-07-10 問い: 現在の実装はどこまで一周するか
- 答え: 9 screenでTheater Command→Camp→Deployment→Battle→After Action→次戦略turnを結び、save v8のversioned localStorage providerで保存する。backend/API/DBは持たない
- 状態: [検証済み] / ソース: `src/app/routes.ts`、`src/app/App.tsx`、`src/game/save/localStorageProvider.ts`、`src/game/save/migrations.ts`、`FILEMAP.md`
- 検証条件: cwd=`/Users/oiwa/projects/個人_takawasi/takawasi game`、2026-07-10のsource read+`npm run build`
- 着地先: 01_PLAN ルーブリック/網羅表、04_STATE 現在地

## 2026-07-10 問い: 現在の検証強度と穴は何か
- 答え: `npm run build`は成功し、206件のJSON QA reportがある。一方で自動回帰test scriptはなく、最新command issue系はFILEMAP上browser-unverified、main JSは約754 kBのchunk警告
- 状態: [検証済み] / ソース: `package.json`、`outputs/`、`FILEMAP.md`、2026-07-10 build log
- 検証条件: cwd=`/Users/oiwa/projects/個人_takawasi/takawasi game`、src files=182、screen=9、QA artifacts=221、JSON reports=206
- 着地先: 04_STATE 発見リスト、01_PLAN 候補置き場

## 2026-07-10 問い: Takawasi Gameで既に人間が固定した製品境界は何か
- 答え: 製品版/DLC1規模を前提とし、動的五帯戦線、戦略/戦術map分離、主戦場省略不可、小作戦3〜4件のみauto-resolve、logic-first、戦術結果の後続画面carryoverを守る
- 状態: [検証済み] / ソース: `docs/00_DECISIONS.md`、`docs/01_PRODUCT_REQUIREMENTS.md`、`docs/08_STRATEGIC_CAMPAIGN_MAP.md`、`docs/10_TACTICAL_AUTONOMY_AND_FRONTLINE.md`、`FILEMAP.md`
- 着地先: 00_MISSION 第0層、root AGENTS/CLAUDE

## 着任パック(クローン配員用のナレッジ資産。05_CONTRACTSのクローン配員節が使う)

反復して委譲する領域の知識は、台帳の項目から**着任パック**に編集して版管理する。
書き方の規則:

- **宛先は赤の他人**: 会話もプロジェクト経緯も知らないクローンが、これだけ読んで
  作業に入れるか(他人テスト)で完成を判定する
- 含めるもの: 領域の確定事実(状態タグ+as-of日付つき・逐語)/使う用語と定義/
  やってはいけないこと/負の知識(この領域で探して無かったもの・棄却済みの案)
- 含めないもの: 経緯・作業メモ・未検証の推測(入れるなら[未検証]タグを明示)
- 置場: `hub/briefs/packs/〔領域名〕_着任パック.md`。改訂したら版番号を上げる
  (ブリーフ雛形と同じく誤り増幅器——改訂後の初回使用を必ず検収する)

## 能力台帳(エージェント+ツールチェーンで今できること。実証つき)

エージェントの自己能力の知識は測定値でなく訓練時の記憶であり、系統的に古い方向へ歪む
(知識の鮮度は過信し、道具の能力は過小評価する非対称がある)。完成の閾値がMVPに
係留されるのはこの歪みが原因——「検証できないから動けば完了」は、検証できた時代遅れの
自己像から出た判定であることが多い(根拠: CHANGELOG v2.1)。

規則:
- **「できない」判定は、この台帳の負の知識か、最小プローブ(安い試行)の失敗証跡を
  根拠に持たない限り無効**。訓練知識由来の不可能判定で完了条件を切り下げない
- 能力の登録は実証つきのみ: 内容 / as-of日付 / 証跡(どのプロジェクトで観測したか)
- 計画・完了条件を書くとき(01のフェーズ設計・02の書き直し・再計画議題)は
  この台帳と突合する。完成の閾値は「動く」でなく
  **この台帳上で検証可能な最高水準の軸**で書く
- 能力は上がり続ける前提で運用する: プローブが成功したらその場で台帳に登録する
  (成功したプローブ自体が実証)

初期登録(テンプレ利用時に自環境で再検証して引き継ぐ):

- 実機スクショ→画像Read→軸ルーブリック採点のループ / as-of 2026-07-09 /
  証跡: takawasigame2(Callcrew) V0ループ、別モデルの独立再採点で6/6軸再現
- 画像生成+image_edit参照差分でのアクション別スプライト量産(画風維持) /
  as-of 2026-07-09 / 証跡: takawasigame2 §12アクションパック
- 撮影・検査ツールの自作(判断ゼロのルーチンの計器化) / as-of 2026-07 /
  証跡: llm-screenshot.mjs、check.sh系
- ワーカー委譲+機械受入での実装(一発合格率5/5) / as-of 2026-07-08 /
  証跡: saikyo-workflowウェーブ003-011

## 負の知識(探して見つからなかったもの・棄却した案)

- [内容 / 検索日 / 検索方法]

---

(以下、新しい項目を上に追記)
