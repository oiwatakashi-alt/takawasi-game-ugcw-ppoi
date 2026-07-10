# M4 三窓レビュー採否台帳

| ID | 窓 | 指摘/根拠 | 採否 | 理由 |
|---|---|---|---|---|
| MACRO-01 | macro | 方式Aをそのままcontent量産へ進めると、手動QAとsave/reload未検証が全損リスクになる | 採用 | 01_PLANの動的欠陥premortemとM3/M4証跡に一致。量産前の方式ゲートにする |
| MACRO-02 | macro | staleなblocked artifactは現行判定資料ではない | 保留/削除候補 | 歴史証拠なのでM4検収後まで残し、削除候補として監査する |
| MICRO-01 | micro | `App`、`BattleCommandScreen`、localStorageの境界がbattle replay/save契約になっていない | 採用 | Bの次wave受入条件にseed/replay/save-reloadを入れる。今ターンの個別修正はしない |
| MICRO-02 | micro | `resolveTick`はBのpure engineへの移行足場 | 採用候補 | コード形状からの推定。実行fixtureで決定性を証明するまで確定採用しない |
| MARKET-01 | market | UGCWの長期campaign魅力と決め打ち批判 | 採用 | 次の実操作で戦果が戦略分岐へ可視に残るかを判定する |
| MARKET-02 | market | Radio Generalの半自律命令/fog/progression魅力 | 採用 | TakawasiのStandingOrders/戦線/履歴の説明可能性を検収する |
| MARKET-03 | market | UoC2のlogistics魅力とtutorial不足 | 採用 | 初回説明導線をcontent量産の前提条件として扱う |
| MARKET-04 | market | The Last Spellのprogression魅力とunlock過多批判 | 採用 | 軍団履歴を単なるgrindへ変えない。倫理境界も維持する |
| HUMAN-01 | human | 現行A/条件付きB/Cのどれを採用するか | 未判定 | 人間の実操作と比較表による判定専任 |

LUNAの暫定判断は「Bを背骨候補、Aの触感と境界を保持、CはB後の量産層」。これは人間判定を代行しない。
