# UGCW 軍規模と戦術マップ演出の設計反映

調査日: 2026-06-30

## 目的

`takawasi game` の軍規模と戦術マップ演出がまだ小さすぎる問題を修正するため、UGCWの軍制規模と戦闘画面の情報構造を設計へ落とす。

## 参照元

- Official Game Guide PDF: https://cdn.steamstatic.com/steam/apps/502520/manuals/UGCW_Guide_v1.25.pdf?t=1606630974
- Starter Guide: https://steamcommunity.com/sharedfiles/filedetails/?id=899790984
- 日本語Wiki 戦闘の基本: https://wikiwiki.jp/ugcw/%E5%85%A5%E9%96%80/%E6%88%A6%E9%97%98%E3%81%AE%E5%9F%BA%E6%9C%AC
- Steam screenshots: https://steamcommunity.com/app/502520/screenshots/

## 軍規模の観察

公式ガイドでは、Army Organizationの最大段階で以下が示されている。

```text
5 Corps x 4 Divisions per Corps x 6 Brigades per Division = 120 Brigades
```

つまり、UGCW的な軍編成画面は「4部隊の小隊管理」ではなく、最終的に軍団、師団、旅団を大量に管理する前提で設計されている。

## takawasi gameへの反映

初期から120旅団を実装する必要はない。ただし、UIは最初から拡張先を見せるべき。

今回の反映:

- 初期軍を4部隊から10旅団規模へ拡張。
- Army画面に `製品版上限 120旅団` を表示。
- I軍団を `4師団 x 6旅団枠` のボードとして表示。
- 第1/第2師団を初期運用、第3/第4師団を軍制不足でロック表示。
- Deploymentの主戦場投入枠を4旅団から6旅団へ拡張。

今後の実装:

- 複数軍団タブ。
- Army Organizationの段階で師団/旅団枠を解放。
- Battle Map側の戦闘ごとに参加可能軍団数/旅団数を変える。
- Corpsごとの補給上限、指揮ペナルティ、予備軍運用。

## 戦術マップ演出の観察

UGCWの戦術画面は、単にユニットがぶつかるだけではない。プレイヤーが見るべき情報は多い。

- VP / Strategic points
- Supply points
- Visibility boost points
- Terrain cover and movement penalties
- Defensive positions and their facing
- Enemy approaches
- Minimap
- Unit command palette
- Battle phase / objective timer

日本語Wikiの戦闘基本でも、地形、側面、重要地点、補給地点、偵察地点、ミニマップが重要な判断要素として整理されている。

## takawasi gameへの反映

今回の反映:

- Tactical Battleに以下を追加。
  - 勝利地点
  - 補給点
  - 視界点
  - 森林遮蔽
  - 泥濘減速
  - 補給道
  - 敵北進路/敵主波/沼地迂回
  - 前線破線
  - ミニマップ
  - 命令リボン
  - 参加旅団数
  - 敵波カウンタ

これはまだ演出の骨格であり、次は地形画像、VP占領、補給点効果、視界点効果をロジックへ接続する。

## 画像生成への含意

戦術マップ用画像は、単体の背景絵より先に、読みやすいゲーム部品が必要。

優先度高:

- VP旗
- 補給点アイコン
- 視界点アイコン
- 敵進入矢印
- 地形ラベル/地形タイル
- ミニマップ記号
- 防衛線/塹壕の向き付きタイル

## 判断

UGCWらしさは軍規模と戦術マップ情報量にかなり依存する。初期実装で全部のロジックを入れない場合でも、画面上に「将来の軍規模」と「戦術判断の情報層」を見せる必要がある。
