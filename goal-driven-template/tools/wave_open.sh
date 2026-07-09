#!/usr/bin/env bash
# wave_open.sh — 新ウェーブの開始: plans/の次番号で計画を生成し、STATEの現在ウェーブを更新。
# 使い方: bash tools/wave_open.sh 名前   (名前はスペース不可・日本語可。どこから実行してもよい)
set -u
cd "$(dirname "$0")/.." || exit 1
NAME="${1:?使い方: bash tools/wave_open.sh 名前}"
case "$NAME" in *" "*) echo "[赤] 名前にスペース不可(10_NAMING_RULES.md)"; exit 1;; esac

last=$(find plans -maxdepth 1 -name '[0-9][0-9][0-9]_*.md' 2>/dev/null | sed 's|.*/||' | cut -c1-3 | sort -n | tail -1)
next=$(printf '%03d' $(( 10#${last:-000} + 1 )))
f="plans/${next}_${NAME}.md"
[ -f "$f" ] && { echo "[赤] $f が既に存在する"; exit 1; }

sed "s/\[NNN\]/${next}/g; s/\[名前\]/${NAME}/g" plans/_TEMPLATE.md > "$f"
TODAY=$(date '+%Y-%m-%d')
sed "s|^- 現在ウェーブ: .*|- 現在ウェーブ: ${next}_${NAME}(開始: ${TODAY}。計画はplans/の同番号)|" 04_STATE.md > 04_STATE.md.tmp \
  && mv 04_STATE.md.tmp 04_STATE.md

echo "[緑] 作成: $f — スコープ・受入条件・見積もりを埋めてから着手すること"
echo "[緑] STATE更新: 現在ウェーブ = ${next}_${NAME}"
