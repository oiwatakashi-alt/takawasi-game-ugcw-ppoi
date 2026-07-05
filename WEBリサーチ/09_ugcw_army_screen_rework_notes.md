# UGCW Army画面 UI再設計メモ

調査日: 2026-06-30

## 問題

初回の `ArmyCampScreen` は、部隊カードを横に並べた抽象UIだった。これはゲームループの説明にはなるが、UGCWの軍編成画面ではない。

画像アセットを読み込んでも、次のUI構造がない限りUGCW的には見えない。

- 軍団単位のまとまり
- 師団ごとの横列
- 旅団スロット
- 空き/ロック枠
- 右側の選択中旅団詳細
- 兵力、士気、経験、装備、将校、補充操作
- Army Organizationや補給上限のような軍制制限

## 参照元

- Official Game Guide PDF: https://cdn.steamstatic.com/steam/apps/502520/manuals/UGCW_Guide_v1.25.pdf?t=1606630974
- Official site screenshots: https://www.ultimategeneral.com/ug-civil-war.html
- Steam Newbie Guide screenshot/reference: https://steamcommunity.com/sharedfiles/filedetails/?id=2120525097
- Steam Starter Guide: https://steamcommunity.com/sharedfiles/filedetails/?id=899790984

## UGCW Army画面の観察

UGCWのArmy画面は、一般的なカード一覧ではなく、軍団内の師団/旅団をスロットで見る管理画面に近い。

画面の主役は個別カードの装飾ではなく、どの軍団に、どの師団があり、どの旅団がどの枠にいるかという編成密度。

プレイヤーはここで次を判断する。

- どの旅団が主戦場に出るのか
- どの旅団を補充するのか
- 補充を新兵にするか古参兵にするか
- どの将校がどの旅団についているか
- 武器在庫と旅団装備が足りているか
- Army Organization制限で未解放の枠がどこか

## takawasi gameへの修正方針

`ArmyCampScreen` は以下に作り直す。

```text
左: 軍団概要
  - 軍団名
  - 総兵力
  - 平均経験
  - 補給上限
  - 補充プール

中央: 軍団ボード
  - I軍団 戦闘序列
  - 第1師団 / 第2師団 / 第3師団
  - 旅団スロット
  - 空き枠
  - Army Org不足のロック枠

右: 選択中旅団詳細
  - 部隊名
  - 兵種
  - 指揮官
  - 兵力/士気/疲労回復/弾薬/経験メーター
  - 装備と在庫
  - 新兵/古参兵補充
  - 部隊史
```

## 画像生成との関係

画像は後で効くが、画像だけではUGCWらしさは出ない。

必要な画像は、旅団スロット内の小旗、将校肖像、兵種アイコン、武器シルエット、紙/金属UIパーツなど。だが、これらは軍団ボード構造がある前提で効く。先にUI構造を固定し、その後P1アセットとして差し替える。

## 実装反映

- `src/components/screens/ArmyCampScreen.tsx`
  - カード一覧を廃止。
  - 軍団概要、師団列、旅団スロット、旅団詳細パネルに再構成。
- `src/styles/app.css`
  - `army-management-screen`
  - `army-side-panel`
  - `army-board`
  - `division-row`
  - `brigade-slot`
  - `unit-inspector`
  - `stat-meter`

今後の追加候補:

- 旅団ドラッグ入替
- 将校任命
- 武器差し替え
- 新規旅団作成
- Army Organizationによる枠解放
- 出撃可能枠/戦闘参加枠との連動
