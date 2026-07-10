# Takawasi Game local desktop一周 再現手順

## 起動

```bash
cd "/Users/oiwa/projects/個人_takawasi/takawasi game"
npm ci
npm run dev -- --host 127.0.0.1
```

ブラウザで `http://127.0.0.1:5173/` を開く。今回の取得は既存のlocal save（第2戦略ターン）から開始した。別の保存状態で再現する場合は、タイトル上部の「戦役をリセット」を一度操作してから同じ導線を開始する。

## 操作ログ

1. Theater: 主戦場「東方辺境防衛線防衛戦」を確認し、「幕舎で準備する」。
2. Camp: Army Campで部隊史・司令部・資源を確認し、「出撃配置へ」。
3. Deployment: 6/6旅団と森林・湿地/泥濘・塹壕/掩体の地形情報を確認し、「選抜部隊で戦闘開始」。
4. Battle: 「3倍」を選択し、「勝利点保持」を発令。約10秒の実時間で防衛時間53/150秒まで進行。
5. Battle: 戦線維持9%、勝利点0%、視界点0%、指揮信号途絶/命令混線を確認。「戦果報告へ」。
6. After Action: 戦線崩壊、戦利品、装備摩耗、目標イベント対応、次戦教訓、負傷将校を確認。「結果を反映して幕舎へ」。
7. 次ターン: 第3戦略ターンのCampに戻り、資源・部隊史・装備品質の変化を確認。

## 期待する証跡

- 6画面のPNG: `takawasi-local-loop-01-theater.png` 〜 `06-next-turn.png`
- `takawasi-local-loop-qa-report.json` の `consoleErrors=0`、`brokenImages=0`、`horizontalOverflow=false`
- Battleが勝利でなくても、After Actionと次ターンへ結果が反映されること。今回の観測結果は「戦線崩壊」として保存し、勝利に書き換えない。
