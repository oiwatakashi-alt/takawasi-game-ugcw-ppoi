# Battle Simulation Contract v0.1

## 目的

方式Bへ移る前に、現行AのBattle画面と主戦場境界を壊さず、戦闘状態を再現可能な単位で保存・復元する。方式Bの再現性経路は、seed付きeffect logと決定的なtick replay fixtureを採用する。完全な命令入力リプレイはこの受入の必須条件にはせず、追加拡張として扱う。

## 保存契約

- `SaveEnvelope.saveVersion` は `9`。
- `SaveEnvelope.activeBattle` に進行中または終了済みの `BattleState` を格納する。
- `App`起動時にactive battleがあれば、進行中はBattle、終了済みはAfter Actionへ復元する。
- After Actionから幕舎へ移るとactive battleを消し、通常のcampaign saveへ戻る。
- 戦闘状態は既存のlocalStorage providerだけで保存する。backend/API/DBは追加しない。

## 監査契約

`BattleState.audit` は次を保持する。

- `seed`: scenario id・operation id・sector idから計算した固定seed
- `tickCount`: 経過tick数
- `lastDigest`: 主要な戦況値から計算した直近digest
- `events`: `battle_started` / `command` / `tick` / `battle_finished` のeffect log（直近240件）
- `replayInputs`: `elapsedSeconds`を照合しながら適用する決定的tick入力列（直近240件）

各イベントは経過秒、ラベル、digest、変化した自軍部隊ID、変化した敵IDを持つ。digestは兵力・士気・弾薬・位置・命令・敵損耗・施設・目標状態を対象にし、表示文や保存時刻は対象外とする。

## 現ターンの受入

| 契約 | 状態 | 根拠 |
|---|---|---|
| Battle中の保存 | 緑 | `saveCampaign(campaign, battle)` |
| Battle更新後の再読み込み | 緑 | 23秒付近で更新後もBattle復元、31秒まで継続 |
| 終了Battleの再読み込み | 緑 | 撤退→After Action後の更新で戦果報告を復元 |
| 結果反映後のactive battle消去 | 緑 | After Actionから第3戦略ターン幕舎へ遷移しBattle表示なし |
| effect log/digest | 緑 | `src/game/battle/audit.ts`、Battle stateへ接続 |
| 同一tick入力の結果一致fixture | 緑 | `battle-replay-fixture.html`、5tickで初期digest `9ad584c4`から同一最終digest `45dfaf3a` |
| 完全な命令入力リプレイ | 追加拡張 | effect log経路を選択したため方式B受入の必須条件外 |

方式Bの受入は保存復元、seed付きeffect log、同一tick入力の結果一致、既存A UI/主戦場境界で緑。次はviewport契約と初回説明へ進む。

## 境界

- 戦略mapと戦術mapは分離する。
- 主戦場は省略不可、auto-resolveは小作戦だけ。
- 画像生成は保存・再現性・viewport・動きの因果を確認した後の局所アセットに限定する。
