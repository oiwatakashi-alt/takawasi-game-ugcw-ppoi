# M4 ミクロ窓レビュー — LUNA直列実行

1. 結論: ゲームロジックの純粋関数化された核はBへの足場になるが、UI時間制御・画面遷移・save境界が同じ契約になっていない。
2. 良好: `src/game/battle/resolveTick.ts:1510`の`resolveTick`は`BattleState`を受けて次状態を返すため、seed付きfixture/replayの対象にできる。
3. 良好: `src/app/App.tsx:76-79`はcampaign/screen/battle/lastResultを別stateで保持し、戦略map・battle・After Actionの境界は追跡できる。
4. P1相当の未検証: `src/game/save/localStorageProvider.ts:15-35`が保存するのはcampaign envelopeで、battle stateのsave/reloadは対象導線で証明されていない。再現手順: Battle中にreloadし、同じbattleを継続できるか確認する。
5. P1相当の設計臭: `BattleCommandScreen.tsx:2766-2772`が`window.setInterval`と`onChange(resolveTick(battle))`を所有する。React再描画とtick時間の再現契約が分離されていない。
6. P2相当の受入不足: `qa-report-v5.json`はconsole/broken image/overflowとcarryoverを証明するが、seed/replay、save/reload、複数failure pathは証明しない。
7. 採否: Bの「pure engine + event/effect log + replay fixture」は採用候補。次のcode waveで勝手に実装せず、人間の方式判定後に昇格する。
8. 採否: Aの画面骨格と主戦場省略不可境界は維持候補。手動QAだけでcontent量産を開始する案は棄却。
9. 置いた仮定: `resolveTick`の戻り値が同じ入力で決定的であることはコード形状からの推定で、seed/replay実行では未検証。
10. 見なかった範囲: mobile、backend、online multiplayer、balance、performance benchmark。
11. 逸脱: なし。外部モデルは起動せず、LUNAが独立情報状態で検査した。
12. 要エスカレーション: Y。save/reloadを次の方式判定の条件にするか人間が決める。
