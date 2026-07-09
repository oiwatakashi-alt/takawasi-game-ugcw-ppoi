#!/usr/bin/env bash
# wave_stats.sh — plans/全ウェーブの見積もりvs実績を集計する(再計画議題①の材料)。
# 使い方(プロジェクトルートで): bash tools/wave_stats.sh
# 出力される補正係数を次の見積もりに掛ける(参照クラス較正)。どこから実行してもよい。
set -u
cd "$(dirname "$0")/.." || exit 1
printf '%-34s %6s %6s %6s\n' "ウェーブ" "見積" "実績" "比率"
sum_e=0; sum_a=0; filled=0
for f in plans/[0-9][0-9][0-9]_*.md; do
  [ -f "$f" ] || continue
  e=$(grep -E '^- 見積もり:' "$f" | grep -oE '[0-9]+' | head -1 || true)
  a=$(grep -E '消費ターン:' "$f" | grep -oE '[0-9]+' | head -1 || true)
  name=$(basename "$f" .md)
  if [ -n "${e:-}" ] && [ -n "${a:-}" ]; then
    r=$(awk "BEGIN{printf \"%.2f\", ${a}/${e}}")
    printf '%-34s %6s %6s %6s\n' "$name" "$e" "$a" "$r"
    sum_e=$(( sum_e + e )); sum_a=$(( sum_a + a )); filled=$(( filled + 1 ))
  else
    printf '%-34s %6s %6s %6s\n' "$name" "${e:-?}" "${a:-未}" "-"
  fi
done
if [ "$sum_e" -gt 0 ]; then
  echo "---"
  awk "BEGIN{printf \"補正係数(実績計/見積計、${filled}本): %.2f — 次の見積もりにこれを掛けよ\n\", ${sum_a}/${sum_e}}"
else
  echo "(実績の揃ったウェーブがまだない)"
fi
