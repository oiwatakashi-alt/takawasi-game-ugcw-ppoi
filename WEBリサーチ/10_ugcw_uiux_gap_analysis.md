# UGCW UI/UX GUI差分分析と追加実装メモ

調査日: 2026-06-30

## 目的

`takawasi game` の現UIを、UGCWのCamp/Battle Map/Armory/Career/Deployment系GUIと比べ、抽象化しすぎている箇所を洗い出して実装へ反映する。

## 参照元

- Official Game Guide PDF: https://cdn.steamstatic.com/steam/apps/502520/manuals/UGCW_Guide_v1.25.pdf?t=1606630974
- Official site: https://www.ultimategeneral.com/ug-civil-war.html
- Steam Step-by-Step Newbie Guide: https://steamcommunity.com/sharedfiles/filedetails/?id=2120525097
- Steam discussion on Deploy screen: https://steamcommunity.com/app/502520/discussions/0/152390648083367448/
- Career Points Wiki: https://ugcw.fandom.com/wiki/Career_Points

## 比較結果

| 領域 | UGCW側のGUI役割 | 旧takawasi UIの不足 | 追加方針 |
| --- | --- | --- | --- |
| Campaign / Battle Map | 戦闘旗、主戦闘/小戦闘、報酬、参加制限、次戦への影響を確認する | 5層マップと作戦名だけで、戦闘旗・報酬・効果が弱い | 主戦場旗、投入枠、危険度、勝利効果チップを追加 |
| Army | 軍団、師団、旅団スロット、空き枠、ロック枠を見る | カード一覧に抽象化しすぎ | `09_ugcw_army_screen_rework_notes.md` の軍団ボードへ修正済み |
| Armory | 武器在庫、必要数、不足、装備中部隊を比較する | 在庫カードだけで、どの部隊にどう足りないかが見えない | 武器表、選択中武器詳細、装備中部隊、不足表示を追加 |
| Career | Career Pointsをカテゴリへ投入し、軍制や兵站などの長期方針を決める | 取得済みカード表示だけ | 参謀会議、方針点、カテゴリ別ピップ、方針点投入を追加 |
| Deployment | 参加上限内で旅団を選び、開始配置枠へ入れる | 出撃可能部隊一覧だけで、投入枠がない | 6枠の開始配置、予備旅団、選抜部隊だけ戦闘へ渡す処理を追加 |

## 実装反映

- `src/components/screens/TheaterCommandScreen.tsx`
  - 主戦場旗
  - 投入枠6旅団
  - 危険度
  - 勝利/作戦効果チップ

- `src/components/screens/ArmoryScreen.tsx`
  - 武器一覧表
  - 選択中武器インスペクタ
  - 在庫/必要/不足
  - 装備中部隊一覧

- `src/components/screens/DoctrineScreen.tsx`
  - Career Points風の方針点画面
  - 参謀方針カテゴリ
  - ピップ表示
  - 方針点投入処理

- `src/components/screens/DeploymentScreen.tsx`
  - 4枠の開始配置枠
  - 予備旅団
  - 投入/解除
  - 選択旅団だけ `createBattleState` へ渡す

- `src/game/battle/createBattleState.ts`
  - `deployedUnitIds` を受け取り、戦闘参加部隊を絞る。

- `src/app/App.tsx`
  - Deploymentから選択旅団IDを受けて戦闘開始。
  - 参謀方針点投入をキャンペーン状態へ反映。

## 残る大きな不足

1. Army画面
   - 旅団ドラッグ入替
   - 新規旅団作成
   - 将校任命
   - 武器差し替え
   - Army Organizationによる枠解放

2. Armory画面
   - 実際の武器購入
   - 部隊ごとの武器割当
   - 武器価格、性能差、在庫更新

3. Career画面
   - 方針点の段階効果
   - 各システムへの具体反映
   - Reputation購入/消費

4. Deployment画面
   - ドラッグ配置
   - 右翼/左翼/予備などの開始エリア
   - 地形上への配置プレビュー

5. Battle画面
   - 戦闘目標旗
   - ミニマップ
   - 部隊選択/命令パレット
   - 補給車/将軍ユニット
   - 複数フェーズ戦闘

6. After Action画面
   - 損耗/戦果の表形式
   - 部隊ごとの経験増加
   - 戦利品/報酬
   - 士官負傷/戦死の専用通知

## 判断

画像生成は重要だが、今回の不足は画像ではなくGUI構造の不足だった。先に、Battle Map/Armory/Career/Deploymentに「判断するための情報密度」を足すべきだった。

今回の追加で、カードUIから管理ゲームUIへ一段寄せた。次のUI優先順位は、Battle画面の命令パレットとAfter Actionの戦果表。
