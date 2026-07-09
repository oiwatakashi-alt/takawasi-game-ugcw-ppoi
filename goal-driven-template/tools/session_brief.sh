#!/usr/bin/env bash
# session_brief.sh — 起動ブリーフ+規則注入(v2.0。毎ターン最初に実行)。
# 出力: 北極星 / 04_STATE全文 / git直近10 / 08_LOG直近2件 / 未処理キュー / 計器+配車 /
#        配車された番の規則(03_DISPATCH.mdから逐語で注入)
# 規則は「読みに行く義務」でなく「注がれる環境」にする——読む義務は脱落するが注入は
# 脱落しない(v2.0設計原理1)。どこから実行してもよい。bash 3.2互換。
set -u
cd "$(dirname "$0")/.." || exit 1

echo "===== 起動ブリーフ $(date '+%F %T') ====="
echo ""
echo "----- 北極星(00_MISSION.md) -----"
awk '/^## 北極星/{f=1} f && /^> /{print; exit}' 00_MISSION.md 2>/dev/null || echo "(00_MISSION.mdなし)"
echo ""
echo "----- 04_STATE.md(現在) -----"
cat 04_STATE.md 2>/dev/null || echo "(04_STATE.mdなし)"
echo ""
echo "----- git log 直近10(事実) -----"
git log --oneline -10 2>/dev/null || echo "(gitリポジトリ外)"
echo ""
echo "----- 08_LOG.md 直近2件(経過) -----"
if [ -f 08_LOG.md ]; then
  start=$(grep -n '^## T[0-9]' 08_LOG.md | tail -2 | head -1 | cut -d: -f1 || true)
  if [ -n "${start:-}" ]; then tail -n +"$start" 08_LOG.md; else echo "(記入なし)"; fi
else
  echo "(08_LOG.mdなし)"
fi
echo ""
echo "----- 未処理キュー -----"
for d in hub/mail/to-* hub/inbox/to-*; do
  [ -d "$d" ] || continue
  c=$(find "$d" -maxdepth 1 -type f ! -name '.*' | wc -l | tr -d ' ')
  [ "$c" -gt 0 ] && echo "  $d: ${c}件"
done
dc=$(find user/drop -maxdepth 1 -type f ! -name '.*' 2>/dev/null | wc -l | tr -d ' ')
hc=$(find hub/humanops/open -maxdepth 1 -type f ! -name '.*' 2>/dev/null | wc -l | tr -d ' ')
echo "  user/drop(投入): ${dc}件 / humanops open(人間待ち): ${hc}件"
echo ""
echo "----- 計器+配車 -----"
check_out=$(bash tools/check.sh 2>&1 || true)
echo "${check_out}"
echo ""

# --- 配車された番の規則を03_DISPATCH.mdから逐語で注入 ---
station=$(printf '%s\n' "${check_out}" | grep '^== 配車:' | grep -oE '(偵察|実行|監査)番' | head -1 || true)
station="${station:-実行番}"
echo "----- 現在番の規則(03_DISPATCH.md「${station}」を逐語注入。この規則だけで働く) -----"
awk -v pat="^## ${station}" '
  $0 ~ pat {f=1; print; next}
  f && /^## / {exit}
  f {print}
' 03_DISPATCH.md 2>/dev/null || echo "(03_DISPATCH.mdなし)"
echo ""
echo "===== ブリーフ終了。上の配車を引用して番を宣言してから作業に入る ====="
