# Takawasi Game local loop reproduction v6

## Target

- URL: `http://127.0.0.1:5174/`
- Viewport: 1280x720, device scale factor 2
- Start: Theater / 第2戦略ターン
- End: Theater / 第3戦略ターン

## Reproduction

1. Theaterで`幕舎で準備する`を押す。
2. Campで`出撃配置へ`を押す。
3. Deploymentで`選抜部隊で戦闘開始`を押す。
4. Battleで目標`勝利点保持`を発令する。
5. `3倍`を選び、防衛時間を進めて`撤退実行`を押す。
6. `戦果報告へ`を押す。
7. After Actionで`結果を反映して幕舎へ`を押す。
8. Campで`戦略マップへ戻る`を押す。

## Observed impact

- Battle: `目標対応: 勝利点保持へ2旅団を投入。主線保持。担当戦線 塹壕補修線。`を確認。
- After Action: 弾薬消費162、補給消費8、勝利点喪失0%、補給点保持100%、視界点喪失0%。勝利点保持の責務が部隊・将校結果へ残る。
- 次ターン: `第3戦略ターン`、`5層戦線`、`東方辺境防衛線防衛戦`を確認。直前報告に戦闘撤退、勝利地点喪失、補給点保持、後衛追撃被害抑止が表示される。
- 判定: 勝利ではなく、勝利地点を失いながら補給点を保持した制御撤退。戦果が次ターンの敵圧・資源・責任表示へ伝播している。

## Screen QA

- Console errors: 0
- Broken images: 0
- Horizontal overflow: false
- `document.scrollWidth`: 1280 / `document.clientWidth`: 1280

詳細な機械取得値は`outputs/takawasi-local-loop-qa-v6-2026-07-10.json`に固定した。
