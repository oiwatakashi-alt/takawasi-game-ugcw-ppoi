# UGCW 基本シーン遷移リサーチ

調査日: 2026-06-30

## 目的

現行実装が「戦略、軍編成、戦闘準備、戦闘」が一体化して見える問題を修正するため、`Ultimate General: Civil War` の基本シーン変化を設計根拠として整理する。

## 参照元

- Official Steam Game Guide PDF: https://cdn.steamstatic.com/steam/apps/502520/manuals/UGCW_Guide_v1.25.pdf?t=1606630974
- Battles Wiki: https://ugcw.fandom.com/wiki/Battles
- Steam Newbie Guide: https://steamcommunity.com/sharedfiles/filedetails/?id=1274743463

## 確認した基本構造

UGCWは、少なくとも次の役割を画面単位で分けている。

1. Campaign / Battle Map
   - キャンペーンステージ、Grand battle、side-battleを選ぶ層。
   - Grand battleは進行上の主戦闘で、side-battleは軍の成長や主戦闘の準備に寄与する。

2. Camp
   - Army / Armory / Barracks / Career のような準備タブを持つ。
   - 部隊編成、武器、将校、キャリアポイントを戦闘前後で調整する。

3. Battle Selection / Reward Window
   - 戦闘旗や任務を選び、得られる報酬や制約を確認する。
   - どの戦闘にどの規模で入るかをCamp判断に戻す材料になる。

4. Deployment
   - 戦闘開始直前、出撃可能な部隊を開始エリアに配置する層。
   - Steam Newbie Guideでも、Start後に開始ボックスで部隊を配置・修正できる流れが説明されている。

5. Tactical Battle
   - 地形、士気、補給、部隊命令、目標を扱う戦闘専用画面。

6. Result / After Action
   - 戦果、損耗、経験、報酬、次戦への持ち越しを確認する。
   - その後Camp/次キャンペーン判断へ戻る。

## takawasi gameへの反映

このゲームは固定史実キャンペーンではないため、UGCWの歴史ステージ構造をそのまま使わない。代わりに、5層戦略マップが毎ターン「主戦場1件」と「小任務3-4件」を生成する。

ただし、シーン分離はUGCWを踏襲する。

```text
戦略キャンペーンマップ
  -> 小任務の確認/自動解決
  -> 今ターン主戦場を確認
  -> 幕舎
       軍編成
       将校
       兵站・装備
       築城
       参謀方針
  -> 出撃配置
  -> 戦闘
  -> 戦果報告
  -> 結果反映
  -> 幕舎または次ターン戦略マップ
```

## 実装判断

- 主戦場を押した瞬間に戦闘へ入らない。
- 戦略マップからは、まず「幕舎で準備する」へ入る。
- Camp相当の画面はタブ化し、戦略マップとは別の準備層として扱う。
- 戦闘前に必ず `出撃配置` 画面を挟む。
- 戦闘中はCampタブを出さず、戦闘HUDに集中させる。
- 戦果報告後は、損耗や経験を反映して幕舎へ戻す。次戦へ即直行させない。

## 今回の実装範囲

- `campaign-map`
- `camp-army`
- `camp-officers`
- `camp-armory`
- `camp-engineering`
- `camp-doctrine`
- `deployment`
- `battle`
- `after-action`

配置ドラッグ、戦闘旗ごとの詳細報酬プレビュー、Barracks相当の士官市場/学校は後続実装対象。今回の修正では、まずシーンの切り方と導線を正す。
