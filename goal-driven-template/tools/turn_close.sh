#!/usr/bin/env bash
# turn_close.sh — ターン末の契約検査(v2.0。commitした直後に実行)。
# 検査: HEADの番タグ / 04_STATE・08_LOGがHEADに含まれるか / LOG直近報告の行数(20行契約) /
#        ダッシュボードの鮮度。赤が出たら直して amend する。
# 契約の遵守を自己申告から機械検出に変える。どこから実行してもよい。bash 3.2互換。
set -u
cd "$(dirname "$0")/.." || exit 1
STATIONS="偵察 実行 監査"
ok=1

msg=$(git log -1 --pretty=%s 2>/dev/null || true)
if [ -z "$msg" ]; then echo "[赤] commitが存在しない。ターン末はcommitしてから実行"; exit 1; fi

tagged=0
for st in $STATIONS; do
  case "$msg" in "[$st]"*|"[${st}番]"*) tagged=1 ;; esac
done
# 導入・移行commitの互換タグ
case "$msg" in "[整備]"*) tagged=1 ;; esac
if [ "$tagged" -eq 1 ]; then echo "[緑] commitタグ: ${msg}"
else echo "[赤] commitに番タグがない: 「${msg}」(書式: [偵察/実行/監査] 要旨)"; ok=0; fi

files=$(git show --name-only --pretty=format: HEAD)
if echo "$files" | grep -q "04_STATE.md"; then echo "[緑] STATE更新がHEADに含まれる"
else echo "[赤] 04_STATE.mdがHEADに含まれない(欄置換更新を忘れている)"; ok=0; fi
if echo "$files" | grep -q "08_LOG.md"; then echo "[緑] LOG追記がHEADに含まれる"
else echo "[赤] 08_LOG.mdがHEADに含まれない(完了報告の追記を忘れている)"; ok=0; fi

# LOG直近報告の行数契約(20行以内。詳細は所在で指す——長い報告は台帳を殺す)
if [ -f 08_LOG.md ]; then
  last_start=$(grep -n '^## T[0-9]' 08_LOG.md | tail -1 | cut -d: -f1 || true)
  if [ -n "${last_start:-}" ]; then
    log_lines=$(tail -n +"$last_start" 08_LOG.md | grep -c -v '^[[:space:]]*$' || true)
    if [ "${log_lines:-0}" -gt 21 ]; then
      echo "[赤] LOG直近報告が${log_lines}行(契約20行以内)。詳細は証跡・報告ファイルへ移し所在で指す"; ok=0
    else
      echo "[緑] LOG直近報告 ${log_lines}行"
    fi
  fi
fi

# ダッシュボード再生成(冪等・常時)
if command -v python3 >/dev/null 2>&1 && [ -f tools/dashboard_html.py ]; then
  python3 tools/dashboard_html.py >/dev/null 2>&1 || true
  if git status --porcelain 2>/dev/null | grep -q "DASHBOARD.html"; then
    echo "[黄] DASHBOARD.htmlが古かったため再生成した。次のcommitに含めること"
  else
    echo "[緑] ダッシュボードは最新"
  fi
fi

if [ "$ok" -eq 1 ]; then echo "== ターン契約: 合格 =="
else echo "== ターン契約: 違反あり。修正して git commit --amend せよ =="; exit 1; fi
