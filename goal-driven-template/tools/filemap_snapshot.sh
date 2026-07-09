#!/usr/bin/env bash
# filemap_snapshot.sh — 現時点のファイル構造を filemap-history/ に日付付きで保存する。
# 使い方(プロジェクトルートで): bash tools/filemap_snapshot.sh [ラベル]
# 大規模改変(リネーム・構造変更)と再計画ウェーブの前に必ず実行する(10_NAMING_RULES.md)。
# 中身の履歴はgitが持つ。これは「意味の地図」の時点保存——大改変を可逆にするための保険。
# どこから実行してもよい(自己位置特定する)。
set -u
LOOP_ROOT=$(cd "$(dirname "$0")/.." && pwd) || exit 1
REPO_ROOT=$(git -C "$LOOP_ROOT" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$LOOP_ROOT")
cd "$REPO_ROOT" || exit 1
LABEL="${1:-snapshot}"
TS=$(date '+%Y-%m-%d_%H%M')
OUTDIR="$LOOP_ROOT/filemap-history"
mkdir -p "$OUTDIR"
OUT="$OUTDIR/${TS}_${LABEL}.md"
{
  echo "# ファイルマップ履歴 — ${TS} ${LABEL}"
  echo ""
  echo "- git HEAD: $(git rev-parse --short HEAD 2>/dev/null || echo '(gitリポジトリ外)')"
  echo "- 取得理由(ラベル): ${LABEL}"
  echo ""
  echo "## 全ファイル(機械生成につきドリフトなし。.git除外)"
  echo '```'
  find . -type f ! -path './.git/*' ! -path './node_modules/*' ! -path './dist/*' ! -name '.DS_Store' | sort
  echo '```'
} > "$OUT"
echo "保存: $OUT"
