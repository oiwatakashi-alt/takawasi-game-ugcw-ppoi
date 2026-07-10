# UI再編 v1 再現手順

## 起動

```bash
npm run dev -- --host 127.0.0.1
```

ブラウザで `http://127.0.0.1:5173/` を開き、local desktop 1280pxで確認する。

## 画面遷移

1. Theaterで主戦場を確認し、「幕舎で準備する」を押す。
2. Campで2列の旅団カードと右側の旅団詳細を確認し、「出撃配置へ」を押す。
3. Deploymentで2列の配置枠を確認し、「選抜部隊で戦闘開始」を押す。
4. Battleで戦術マップが初期viewport内に出ることを確認する。必要なら3倍速で進め、戦闘終了後に「戦果報告へ」を押す。
5. After Actionで結果・損耗・持越しを確認し、「結果を反映して幕舎へ」を押す。
6. 第4戦略ターンのCampへ戻り、資源・兵力・部隊史への反映を確認する。

## 証跡

- `01-theater-v1.png`
- `02-camp-v1.png`
- `03-deployment-v1.png`
- `04-battle-v1.png`
- `05-after-action-v1.png`
- `06-next-turn-v1.png`
- `qa-report-v1.json`

## 検証境界

- 変更は共通画面骨格、列幅、sticky/scroll、Battleの表示順に限定。
- gameplay、save schema、backend、VPS、会社資産、秘密情報には触れていない。
- 次ループで画像生成アセットを追加する場合も、まずこのスクリーンショット基準を維持してから主役の地形・戦線グラフィックへ局所適用する。
