# Scenario Pack 制作方針

## 目的

Takawasi Gameの製品版/DLC1規模を、場当たり的な画面追加ではなく、型付きScenario Packから制作する。Scenario Packは「戦略mapの戦線」「省略不可の主戦場」「auto-resolve可能な小作戦」「戦果の次ターン持越し」を一つの検証単位にする。

最初の実装対象は `border-emergency-001`（国境非常態勢）。既存の画面挙動を壊さず、`createCampaign`起動時にschemaと境界を検証する。

## 変更するファイル

- 型と検証: `src/content/scenarioTypes.ts`
- 作成入口: `src/content/templates/scenarioPackTemplate.ts`
- Scenario Pack原本: `src/content/baseGame/scenarioPacks.ts`
- 公開registry: `src/content/registries.ts`
- 設計テンプレート: `docs/content/SCENARIO_PACK_TEMPLATE.md`

## 作成手順

1. `docs/content/SCENARIO_PACK_TEMPLATE.md`を複製して企画欄を埋める。
2. `createScenarioPackTemplate({...})`へ、戦略層・戦術層・小作戦・持越しを移す。
3. `npm run build`で型検査を通す。`createCampaign`が起動時に`assertScenarioPackValid`を実行する。
4. 境界検証を通すまでシナリオをruntimeへ接続しない。
5. local desktopでTheater→Camp→Deployment→主戦場Battle→After Action→次ターンを再走する。
6. 小作戦はauto-resolve可、主戦場は`isMandatory: true`かつ`canAutoResolve: false`を維持する。

## 不変条件

- 製品版/DLC1規模をMVP/prototypeへ縮小しない。
- strategic layerとtactical layerを一つのmapへ混ぜない。
- 主戦場をauto-resolveへ逃がさない。
- 小作戦だけauto-resolve可能にする。
- Battle結果を`battleHistory`・資源・敵圧・tactical lessonsへ持ち越せる設計にする。
- UI文言や義務情報を生成画像へ置き換えない。画像は識別性を補強する局所アセットに限る。
- 外部AIモデル、会社GitHub、AWS、Medixus資産を使用しない。

## 次のB方式wave

人間の条件付き続行を受け、content量産の前に以下を検証契約へ昇格する。

- Battle中save/reload
- seed/replayまたはevent/effect logによる再現性
- 戦果が次ターン戦略判断へ可視的に残ること
- 初回プレイヤーがScenario Packの判断導線を理解できること
