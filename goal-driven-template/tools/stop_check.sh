#!/usr/bin/env bash
# stop_check.sh — 停止・フェーズ完了申告の前提棚卸し(早停め病ゲート。v2.2)。
# 停止/完了を申告するターンは、これを実行して出力をLOGに引用する。
# 「もう残っていない」を主張でなく機械の棚卸しにする——LLMは早すぎる停止を
# モデル横断で繰り返す(固定N停止・キュー空錯覚・P0/P1空停止の3類型を実測)。
# このスクリプトは成立判定はしない。残存の可視化と、項目ごとの正当化の強制だけを行う。
# どこから実行してもよい。bash 3.2互換。
set -u
cd "$(dirname "$0")/.." || exit 1

echo "== 停止前棚卸し $(date '+%F %T') =="
remain=0

# 1) 01_PLAN 未チェックのマイルストーン
unchecked=$(grep -cE '^[[:space:]]*- \[ \]' 01_PLAN.md 2>/dev/null || true); unchecked=${unchecked:-0}
echo "- 01_PLAN 未チェックのマイルストーン行: ${unchecked}件([下書き]フェーズ分を含む——引用時に内訳を言うこと)"
[ "$unchecked" -gt 0 ] && remain=1

# 2) STATE ブロッカー
bl=$(grep -E '^- ブロッカー:' 04_STATE.md 2>/dev/null | head -1 || true)
echo "- STATE ${bl:-ブロッカー行が見つからない}"
case "$bl" in *なし*|"") : ;; *) remain=1 ;; esac

# 3) humanops(人間専任待ち)
hc=$(find hub/humanops/open -maxdepth 1 -type f ! -name '.*' 2>/dev/null | wc -l | tr -d ' ')
echo "- humanops open(人間専任待ち): ${hc}件"

# 4) STATE 発見リスト(雛形の [ ] 行を除いて数える)
disc=$(awk '/^## 発見リスト/{f=1;next} /^## /{f=0} f && /^- /' 04_STATE.md 2>/dev/null | grep -cv '^- \[' || true); disc=${disc:-0}
echo "- STATE 発見リスト(未実行の積み): ${disc}件"
[ "$disc" -gt 0 ] && remain=1

# 5) 01_PLAN 候補置き場
cand=$(awk '/^### 候補置き場/{f=1;next} /^#/{f=0} f && /^- /' 01_PLAN.md 2>/dev/null | grep -cv '^- \[' || true); cand=${cand:-0}
echo "- 01_PLAN 候補置き場: ${cand}行"
[ "$cand" -gt 0 ] && remain=1

# 6) 未処理キュー
for d in hub/inbox/to-* hub/mail/to-*; do
  [ -d "$d" ] || continue
  c=$(find "$d" -maxdepth 1 -type f ! -name '.*' | wc -l | tr -d ' ')
  if [ "$c" -gt 0 ]; then echo "- 未処理キュー ${d}: ${c}件"; remain=1; fi
done

# 7) プロジェクト固有の残課題台帳(あれば。QUEUE型の方法論を併用しているプロジェクト向け)
for q in hub/selfresearch/OPEN_QUEUE.md OPEN_QUEUE.md; do
  if [ -f "$q" ]; then
    qn=$(grep -cE '^\| [A-Za-z]' "$q" 2>/dev/null || true)
    echo "- 残課題台帳 ${q}: 表行 ${qn:-0}件(blocked含む——内訳は引用時に)"
  fi
done

echo ""
if [ "$remain" -eq 1 ]; then
  echo "[黄] 残存が非ゼロ。停止を申告するなら、上の項目ごとに"
  echo "     「なぜ停止を正当化するか(blocked / 休眠 / 過剰側 / 人間専任)」をLOGに一行ずつ書くこと。"
  echo "     書けない項目が1つでもあれば、それは停止でなく次の燃料である。"
else
  echo "[緑] 機械で見える残存はゼロ。ただし「全候補が尽きた」と言うには、"
  echo "     軸生成工程(03_DISPATCH)を1回実行して空振りだった証跡がLOGにあること。"
  echo "     証跡がなければ停止でなく軸生成へ。あれば停止条件の成立判定(00_MISSION)に進んでよい。"
fi
