# WEBリサーチ CONTROL

調査対象: Ultimate General: Civil War
調査日: 2026-06-30

## 今回の調査目的

`takawasi game` の設計材料として、`Ultimate General: Civil War` のゲームシステム、とくに育成ゲームとしての面白さを分解する。

単なる紹介ではなく、次の観点で集める。

- 戦闘中の判断がどう次の戦闘に残るか
- 部隊・将校・軍全体の育成がどう絡むか
- プレイヤーが何に悩むよう設計されているか
- 小規模ゲームに抽出できる構造は何か

## 調査ファイル

| File | Status | 内容 |
| --- | --- | --- |
| `ultimate-general-civil-war.md` | done | 軽量な初回概要メモ。 |
| `01_system_overview.md` | done | ゲームシステム全体の構造。 |
| `02_campaign_army_growth_loop.md` | done | キャンペーン、軍編成、育成、資源、評判のループ。 |
| `03_battle_mechanics_command_ui.md` | done | 戦闘システム、地形、士気、指揮UI、部隊種。 |
| `04_growth_game_design_takeaways.md` | done | 育成ゲームとしての面白さと `takawasi game` への抽出。 |
| `05_implementation_model_from_ugcw.md` | done | 実装時のEntity、State、ループ、UI単位への分解。 |
| `06_battle_screen_visual_reference.md` | done | UGCW戦闘画面スクショ/公式ガイドを見た戦闘UI観察メモ。 |
| `07_campaign_and_army_screen_visual_reference.md` | done | UGCWキャンペーン/軍編成/Armory/Barracks/Career画面のUI観察メモ。 |
| `08_ugcw_scene_flow_reference.md` | done | UGCWのCampaign/Battle Map、Camp、Deployment、Battle、Resultの基本シーン遷移を実装判断へ落としたメモ。 |
| `09_ugcw_army_screen_rework_notes.md` | done | UGCW Army画面の軍団/師団/旅団スロット構造を、takawasi gameの軍編成画面へ反映するための再設計メモ。 |
| `10_ugcw_uiux_gap_analysis.md` | done | UGCW比較で不足していたBattle Map、Armory、Career、Deployment GUIの差分分析と追加実装メモ。 |
| `11_ugcw_army_scale_and_tactical_map_design.md` | done | UGCWの最大軍規模と戦術マップ情報層を、初期軍拡張・6旅団投入・VP/補給/視界/ミニマップ演出へ反映する設計メモ。 |
| `12_tactical_rts_combat_model.md` | done | 戦術マップ上の座標、射程、最寄り目標射撃、敵部隊移動、防衛施設処理を初期RTSモデルへ落とした実装メモ。 |
| `13_ugcw_vs_takawasi_battle_animation_gap_research.md` | done | UGCW公式画面/システムと現状戦闘画面・戦術ロジック・軍アニメーション表現の比較。次の整形順を定義。 |
| `90_source_index.md` | done | 参照元と信頼度メモ。 |

## 優先ソース

1. 公式ページ、Steam/GOG/PS/Xboxストア
2. Steam公式ゲームガイドPDF
3. コミュニティWiki
4. Steamガイド、フォーラム、Reddit

コミュニティ情報はプレイヤー観察として有用だが、仕様確定情報としては扱わない。

## 未実施

- 実機プレイ検証
- 動画の内容精査
- MOD込みの変化調査
- 競合作品との横比較
