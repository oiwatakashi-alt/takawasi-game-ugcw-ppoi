#!/usr/bin/env bash
# wave_close.sh — 現ウェーブを閉じる: 実績記入を検査し、STATEの完了ウェーブ数を+1。
# 使い方: bash tools/wave_close.sh (どこから実行してもよい)
set -u
cd "$(dirname "$0")/.." || exit 1
cur=$(grep -E '^- 現在ウェーブ: ' 04_STATE.md | head -1 | sed 's/^- 現在ウェーブ: //; s/(.*//' | tr -d ' ')
[ -z "$cur" ] || [ "${cur#\[}" != "$cur" ] && { echo "[赤] STATEの現在ウェーブが未設定(wave_open.shで開始したか?)"; exit 1; }

plan=$(find plans -maxdepth 1 -name "${cur}*.md" 2>/dev/null | head -1)
[ -z "$plan" ] && { echo "[赤] 現在ウェーブ(${cur})の計画がplans/に見つからない"; exit 1; }

if grep -q '消費ターン: \[ \]' "$plan"; then
  echo "[赤] ${plan} の実績欄が未記入。消費ターン/逸脱/学び一行を埋めてから閉じよ"; exit 1
fi

line=$(grep -E '^- 完了ウェーブ数' 04_STATE.md | head -1 || true)
n=$(printf '%s' "$line" | grep -oE ': *[0-9]+' | head -1 | grep -oE '[0-9]+' || true)
[ -z "${n:-}" ] && { echo "[赤] STATEの完了ウェーブ数が数値でない(初期値[n]のまま?)。一度手で数値にせよ"; exit 1; }
new=$(( n + 1 ))
sed "s|(前回再計画から): ${n} |(前回再計画から): ${new} |" 04_STATE.md > 04_STATE.md.tmp && mv 04_STATE.md.tmp 04_STATE.md

echo "[緑] ウェーブ ${cur} 完了。完了ウェーブ数: ${n} → ${new}"
wt=$(printf '%s' "$line" | grep -oE '再計画トリガー[0-9]+' | grep -oE '[0-9]+' || true)
if [ -n "${wt:-}" ] && [ "$new" -ge "$wt" ]; then
  echo "[赤] 再計画トリガー(${wt})到達。次は filemap_snapshot → 監査番(再計画議題)を強制"
fi
