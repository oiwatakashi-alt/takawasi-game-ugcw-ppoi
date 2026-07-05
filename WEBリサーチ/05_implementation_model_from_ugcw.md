# 実装観点への分解モデル

調査日: 2026-06-30

対象: Ultimate General: Civil War のシステムを、`takawasi game` で使える実装単位へ落とす。

## まず抽出すべきコア

本作の全要素を真似る必要はない。実装上のコアは以下。

```text
CampaignState
  -> ArmyState
  -> BattleState
  -> BattleResult
  -> Recovery/Upgrade Phase
  -> Next CampaignState
```

この循環が成立すれば、育成ゲームとしての芯は出せる。

## 主要Entity案

### Campaign

```text
Campaign
- dayOrChapter
- faction
- reputation
- gold
- recruits
- weaponStock
- careerSkills
- battleHistory
- nextBattles
```

役割:

- 長期状態を保持する。
- 戦闘結果を受け取って、次の準備フェーズへ渡す。
- 評判、金、兵員、武器在庫を管理する。

### Army

```text
Army
- corps[]
- reserveOfficers[]
- woundedOfficers[]
- weaponStock
- supplyPool
```

役割:

- プレイヤーが育てているものの本体。
- ここに愛着が生まれる。

### Corps / Division / Brigade

```text
Corps
- commanderId
- divisions[]
- supply

Division
- commanderId
- brigades[]

Brigade
- id
- name
- unitType
- commanderId
- soldiers
- maxSoldiers
- weaponId
- experience
- stars
- perks[]
- skills
- fatigueMemory optional
- battleHistory[]
```

役割:

- 最初は `Corps/Division` を省略して `Brigade[]` だけでもよい。
- ただし後で拡張するなら階層を想定しておくとよい。

### Officer

```text
Officer
- id
- name
- rank
- experience
- perks[]
- status: active | wounded | dead
- woundRecoveryBattles
```

役割:

- 部隊の上限/効率/士気を支える。
- 死亡や負傷でプレイヤーに痛みを出す。

### BattleUnit

```text
BattleUnit
- brigadeId
- currentSoldiers
- morale
- condition
- ammo
- position
- facing
- currentOrder
- cover
- visibility
- isRouted
```

役割:

- 戦闘中だけの一時状態。
- 戦闘後に `Brigade` へ損耗・経験・履歴を返す。

### BattleResult

```text
BattleResult
- outcome: win | draw | loss
- casualtiesByBrigade
- killsByBrigade
- officerEvents
- weaponsCaptured
- goldReward
- recruitsReward
- reputationDelta
- careerPointsGained
```

役割:

- 戦闘と育成画面をつなぐ。
- ここを丁寧に作ると、戦闘後画面が面白くなる。

## 最小システムループ

### 1. 戦闘前

プレイヤーが見るべきもの:

- 次戦の地形タイプ
- 敵の推定強さ
- 出撃部隊
- 補給量
- 重要リスク

プレイヤーが決めること:

- どの部隊を出すか
- どの部隊に良い武器を渡すか
- 熟練補充を誰に使うか
- 指揮官を入れ替えるか

### 2. 戦闘中

最小でも成立する状態:

- 部隊の人数
- 士気
- 疲労/Condition
- 補給/Ammo
- 地形補正
- 側面判定

命令は最初は4つで十分。

| 命令 | 効果 |
| --- | --- |
| Advance | 移動して接敵。疲労が増える。 |
| Hold | カバー重視で防御。士気が保ちやすい。 |
| Flank | 成功すると敵士気を大きく削る。失敗すると危険。 |
| Rest/Resupply | 攻撃しないがCondition/Ammoを戻す。 |

### 3. 戦闘後

ここが育成ゲームの本体。

表示:

- 勝敗
- 各部隊の損耗
- 経験増加
- 星/Perk獲得
- 将校イベント
- 鹵獲武器
- 報酬

選択:

- Rookieで補充する
- Veteranで補充する
- 補充しない
- 武器を変える
- 将校を入れ替える
- 次のキャリア能力を上げる

## 数式の方向性

本作の正確な式を再現する必要はない。面白さの式だけ抽出する。

### 部隊戦力

```text
effectivePower =
  soldiersFactor
  * weaponFactor
  * experienceFactor
  * moraleFactor
  * conditionFactor
  * commanderFactor
  * terrainFactor
```

ポイント:

- `soldiersFactor` だけで決まらない。
- 士気と疲労を入れると、勝っている部隊も崩れる。
- 地形を入れると、マップを見る意味が出る。

### Rookie補充

```text
newExperience =
  weightedAverage(oldVeteransExperience, rookieExperience, addedRookies)
```

効果:

- 人数は戻る。
- ただし平均経験が落ちる。
- プレイヤーが「この部隊には新人を混ぜたくない」と思う。

### Veteran補充

```text
cost = missingSoldiers * veteranCost * unitQualityMultiplier
experienceLoss = veryLow
```

効果:

- 能力を維持する代わりに金が減る。
- 精鋭は維持費が高い。

### 士気崩壊

```text
moraleDelta =
  - incomingDamageShock
  - flankShock
  - officerLossShock
  - fatiguePenalty
  + generalAura
  + reputationBonus
```

効果:

- キル数以外で勝てる。
- 側面、将校、疲労、評判が戦闘中に意味を持つ。

## UIとして必要な画面

### Campaign / Camp

- 現在資源
- 部隊一覧
- 部隊詳細
- 補充ボタン
- 武器変更
- 指揮官変更
- 次戦カード

### Battle

- マップ
- 部隊アイコン
- 部隊選択パネル
- 士気/人数/疲労/補給
- 命令ボタン
- 戦闘目標

### After Action Report

- 勝敗
- 損耗
- 経験
- 将校イベント
- 戦利品
- 補充/再編への導線

## 実装優先順位

### Phase 1

- 部隊3つ
- 1戦闘
- 士気/人数/経験
- 戦闘後補充
- 次戦への持ち越し

### Phase 2

- 地形
- 疲労
- 指揮官
- 将校負傷/死亡
- Rookie/Veteran補充差

### Phase 3

- 武器在庫
- 補給
- キャリアスキル
- 複数戦闘
- サイドバトル

### Phase 4

- 軍団/師団階層
- 敵情報
- AIスケーリング
- Perk選択
- 史実/物語イベント

## 重要な判断

最初に作るべきは大規模戦闘ではなく、戦闘後にプレイヤーが悩む状態。

良いプロトタイプの条件:

- 1戦終わったあと、次に誰を補充するか迷う。
- 失った部隊名を覚えている。
- 勝っても「損しすぎた」と感じる。
- 負けても「精鋭は守れた」と感じる。

ここが出れば、グラフィックや大規模マップは後で足せる。

## Sources

- Steam Game Guide PDF: https://cdn.steamstatic.com/steam/apps/502520/manuals/UGCW_Guide_v1.25.pdf?t=1606630974
- Official: https://www.ultimategeneral.com/ug-civil-war.html
- Steam Starter Guide: https://steamcommunity.com/sharedfiles/filedetails/?id=899790984
- Career Points Wiki: https://ugcw.fandom.com/wiki/Career_Points
- Unit Skills Wiki: https://ugcw.fandom.com/wiki/Unit_Skills
