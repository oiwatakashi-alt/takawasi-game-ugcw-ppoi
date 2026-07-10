# Scenario Pack 設計テンプレート

## 1. 基本情報

- `id`: 一意な英数字ID
- `name`: プレイヤー向け名称
- `chapter`: 製品版/DLC1内の章・戦区
- `schemaVersion`: `1`

## 2. 戦略層

- `currentSectorId`: 開始時の主戦場セクター
- `rearPressureSectorIds`: 後方圧力・補給線
- `forwardPressureSectorIds`: 前方圧力・敵前進
- `globalThreat` / `enemyMomentum` / `playerStrategicInitiative`
- `sectors[]`: 五帯戦線の各セクター
  - `band`, `control`, `terrainTags`
  - `supplyValue`, `railValue`, `medicalValue`, `engineerValue`
  - `enemyPressure`, `corruptionLevel`
  - `battleTemplates`, `linkedSectors`, `history`
  - 初期施設は`initialStructures`へ置く

## 3. 戦術層

- `battleTemplateIds`: 利用可能な戦場テンプレート
- `mainBattleTemplateId`: 初回主戦場テンプレート
- `description`: 戦術上の検証意図

主戦場のoperationは必ず次を満たす。

```ts
{
  type: "holdSector",
  isMandatory: true,
  canAutoResolve: false,
}
```

## 4. 小作戦

`sideOperations[]`は、各項目が次を満たす。

```ts
{
  isMandatory: false,
  canAutoResolve: true,
}
```

各小作戦には、`titleTemplate`、対象セクター、risk、cost、victory/draw/defeat effectsを記入する。小作戦の結果は主戦場の敵圧・資源・initiative・履歴へ接続できるようにする。

## 5. 戦果持越し

- `visibleResultFields`: After Actionと次ターンで見せる値
- `requiredBattlePersistence`: Battle中保存が成立するまで`true`
- `nextTurnSummaryFields`: 次ターンの直前報告へ出す値

最低限、`battleHistory`を含める。戦果が次の戦略判断を変えないScenario Packは受入不可とする。

## 6. 受入チェック

- [ ] schema validationが0 errors
- [ ] 主戦場がauto-resolve不可
- [ ] 小作戦のみauto-resolve可
- [ ] strategic/tactical mapが分離
- [ ] Battle→After Action→次ターンへ持越し
- [ ] 1280x720 screenshotで主操作と主戦場がfirst viewportに入る
- [ ] console error 0 / broken image 0 / horizontal overflow false
