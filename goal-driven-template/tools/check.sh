#!/usr/bin/env bash
# check.sh — 計器+配車計算(v2.0)。git logの番タグと04_STATE.mdから外形指標を機械算出し、
# 最後に次ターンの配車(番)を計算して出力する。判定基準は11_GOVERNANCE.mdの計器表に対応。
# 使い方: bash tools/check.sh [直近コミット数(既定20)]  (どこから実行してもよい)
# 依存: bash 3.2+(mapfile/tac/連想配列は使わない)+ git のみ。
set -u
cd "$(dirname "$0")/.." || exit 1

N="${1:-20}"
STATE="04_STATE.md"
STATIONS="偵察 実行 監査"
RED=0   # 赤が1つでも出たら配車は監査(規則2)
BASE_FILE=".loop-baseline"
LOOP_RANGE=""

red() { echo "[赤] $1"; RED=1; }

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  red "gitリポジトリではない($(pwd))。プロジェクトをgit initしてから使う"
  echo "== 配車: 監査番(根拠: 規則2 — 赤あり) =="
  exit 1
fi

if [ -f "$BASE_FILE" ]; then
  base_commit=$(head -1 "$BASE_FILE" | tr -d '[:space:]')
  if [ -n "$base_commit" ] && git cat-file -e "${base_commit}^{commit}" 2>/dev/null; then
    LOOP_RANGE="${base_commit}..HEAD"
  else
    red "${BASE_FILE} のbaseline commitが無効。偵察番で再設定せよ"
  fi
fi

loop_log() {
  if [ -n "$LOOP_RANGE" ]; then git log "$LOOP_RANGE" "$@"; else git log "$@"; fi
}

if [ -n "$LOOP_RANGE" ]; then
  total_commits=$(git rev-list --count "$LOOP_RANGE" 2>/dev/null || echo 0)
else
  total_commits=$(git rev-list --count HEAD 2>/dev/null || echo 0)
fi
if [ "${total_commits}" -eq 0 ]; then
  echo "[黄] baseline以後のループcommitが0。導入直後なら正常"
  echo "== 配車: 偵察番(根拠: 規則1 — セッション初回/走行前) =="
  exit 0
fi

# --- 直近Nコミットの件名を古い→新しい順で(bash3.2互換: awkで反転) ---
subjects_rev=$(loop_log -n "$N" --pretty=tformat:'%s' | awk '{a[NR]=$0} END{for(i=NR;i>=1;i--) print a[i]}')
tags=()
untagged=0
n=0
while IFS= read -r s; do
  [ -z "$s" ] && continue
  n=$(( n + 1 ))
  matched=""
  for st in $STATIONS; do
    case "$s" in "[$st]"*|"[${st}番]"*) matched="$st"; break ;; esac
  done
  # v1系の旧タグ(リサーチ/実装/品質/整備/コンテンツ)は互換で「実行」に数える
  if [ -z "$matched" ]; then
    for old in リサーチ 実装 品質 整備 コンテンツ; do
      case "$s" in "[$old]"*|"[${old}番]"*) matched="実行"; break ;; esac
    done
  fi
  if [ -n "$matched" ]; then tags+=("$matched"); else untagged=$(( untagged + 1 )); tags+=("?"); fi
done <<EOF
$subjects_rev
EOF

echo "== 計器 (直近 ${n} commit) =="
echo ""
echo "-- 配車分布 --"
for st in $STATIONS; do
  c=$(printf '%s\n' "${tags[@]:-}" | grep -c "^${st}\$" || true)
  [ "${c:-0}" -gt 0 ] && echo "  ${st}: ${c}"
done
if [ "$untagged" -gt 0 ]; then
  pct=$(( untagged * 100 / n ))
  if [ "$pct" -ge 30 ]; then
    red "番タグなしcommitが ${untagged}/${n} (${pct}%)。commit規約([番名] 要旨)が守られていない"
  else
    echo "[黄] 番タグなしcommitが ${untagged}/${n} (${pct}%)"
  fi
else
  echo "[緑] 全commitに番タグあり"
fi

# --- 計器: テスト増分(実行が積み上がるのにテスト数が動かない=検証の空洞化) ---
echo ""
echo "-- テスト増分 --"
exec_c=$(printf '%s\n' "${tags[@]:-}" | grep -c "^実行\$" || true); exec_c=${exec_c:-0}
test_bumps=$(loop_log -n "$N" -p -- "$STATE" 2>/dev/null | grep -c '^+- テスト数:' || true); test_bumps=${test_bumps:-0}
if [ "$exec_c" -ge 5 ] && [ "$test_bumps" -eq 0 ]; then
  echo "[黄] 実行${exec_c}回でテスト数行の更新0。検証の空洞化の兆候(受入にテストを含めているか)"
else
  echo "[緑] 実行${exec_c}回 / テスト数行の更新${test_bumps}回"
fi

# --- 計器: 証跡鮮度(実行が積み上がるのに証跡置場が動かない=証跡なし完了病) ---
echo ""
echo "-- 証跡鮮度 --"
ev_touches=$(loop_log -n "$N" --name-only --pretty=format: 2>/dev/null | grep -c '^outputs/' || true); ev_touches=${ev_touches:-0}
if [ "$exec_c" -ge 5 ] && [ "$ev_touches" -eq 0 ]; then
  echo "[黄] 実行${exec_c}回で証跡置場(outputs/)への追加0。「直した」に対応する証跡があるか"
else
  echo "[緑] 実行${exec_c}回 / 証跡置場への変更${ev_touches}回"
fi

# --- 計器: STATE鮮度 ---
echo ""
echo "-- STATE鮮度 --"
if [ ! -f "$STATE" ]; then
  red "${STATE} が存在しない"
else
  last_state_commit=$(git log -1 --format=%H -- "$STATE" 2>/dev/null || true)
  if [ -z "$last_state_commit" ]; then
    red "${STATE} が一度もcommitされていない"
  else
    behind=$(git rev-list --count "${last_state_commit}..HEAD")
    if [ "$behind" -ge 3 ]; then
      red "STATE更新から ${behind} commit 経過。台帳の腐敗——偵察番で再建せよ"
    elif [ "$behind" -ge 1 ]; then
      echo "[黄] STATE更新から ${behind} commit 経過(毎ターン更新が規約)"
    else
      echo "[緑] STATEは最新commitで更新済み"
    fi
  fi
fi

# --- 計器: 予算カウンタ(STATEの固定書式行) ---
echo ""
echo "-- 予算カウンタ (04_STATE.md 自己申告値) --"
wn=""; wt=""; over_budget=0
if [ -f "$STATE" ]; then
  turns_line=$(grep -E '^- このフェーズの消費ターン:' "$STATE" | head -1 || true)
  tests_line=$(grep -E '^- テスト数:' "$STATE" | head -1 || true)
  fail_line=$(grep -E '^- 同一失敗カウント:' "$STATE" | head -1 || true)
  [ -n "$turns_line" ] && echo "  ${turns_line#- }" || echo "[黄] 消費ターン行が書式どおりに見つからない"
  [ -n "$tests_line" ] && echo "  ${tests_line#- }"
  [ -n "$fail_line" ] && echo "  ${fail_line#- }"
  # フェーズ予算超過(規則3): 「消費ターン: n / 目安N」の n>N
  spent=$(printf '%s' "$turns_line" | grep -oE ': *[0-9]+' | head -1 | grep -oE '[0-9]+' || true)
  budget=$(printf '%s' "$turns_line" | grep -oE '目安[0-9]+' | grep -oE '[0-9]+' || true)
  if [ -n "${spent:-}" ] && [ -n "${budget:-}" ] && [ "$spent" -gt "$budget" ]; then
    echo "[黄] フェーズ予算超過(${spent}/${budget})。配車は監査番(規則3)"
    over_budget=1
  fi
  fail_value=$(printf '%s' "$fail_line" | sed 's/(.*//')
  fail_max=$(printf '%s' "$fail_value" | grep -oE '[0-9]+回' | grep -oE '[0-9]+' | sort -n | tail -1 || true)
  if [ -n "${fail_max:-}" ] && [ "$fail_max" -ge 3 ]; then
    red "同一失敗${fail_max}回。停止・報告の閾値に到達している"
  fi
  # 総ターン上限(運転設定)
  limit_line=$(grep -E '^- 総ターン上限:' "$STATE" | head -1 || true)
  tlimit=$(printf '%s' "$limit_line" | grep -oE '[0-9]+' | head -1 || true)
  if [ -n "${tlimit:-}" ]; then
    pct=$(( total_commits * 100 / tlimit ))
    if [ "$total_commits" -ge "$tlimit" ]; then
      red "総ターン上限${tlimit}を超過(commit数${total_commits}=代理計器)。停止して人間へ"
    elif [ "$pct" -ge 80 ]; then
      echo "[黄] 総ターン上限の${pct}%を消費(${total_commits}/${tlimit})"
    else
      echo "  総ターン: ${total_commits}/${tlimit}(${pct}%)"
    fi
  fi
  # 期限(運転設定。GNU/macOSのdate両対応)
  dl_line=$(grep -E '^- 期限:' "$STATE" | head -1 || true)
  deadline=$(printf '%s' "$dl_line" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1 || true)
  if [ -n "${deadline:-}" ]; then
    dl_s=$(date -d "$deadline" +%s 2>/dev/null || date -j -f '%Y-%m-%d' "$deadline" +%s 2>/dev/null || true)
    if [ -n "${dl_s:-}" ]; then
      days=$(( (dl_s - $(date +%s)) / 86400 ))
      if [ "$days" -lt 0 ]; then
        red "期限${deadline}を$(( -days ))日超過。停止して人間へ"
      elif [ "$days" -le 7 ]; then
        echo "[黄] 期限${deadline}まで残り${days}日。残ウェーブ数と補正係数(wave_stats)で突合せよ"
      else
        echo "  期限: ${deadline}(残り${days}日)"
      fi
    fi
  fi
  # ウェーブ再計画トリガー(規則4)
  wave_line=$(grep -E '^- 完了ウェーブ数' "$STATE" | head -1 || true)
  if [ -n "$wave_line" ]; then
    echo "  ${wave_line#- }"
    wn=$(printf '%s' "$wave_line" | grep -oE ': *[0-9]+' | head -1 | grep -oE '[0-9]+' || true)
    wt=$(printf '%s' "$wave_line" | grep -oE '再計画トリガー[0-9]+' | grep -oE '[0-9]+' || true)
  fi
fi

# --- 計器: MISSION変更検知(柵への変更は人間承認の突合対象) ---
echo ""
echo "-- MISSION変更検知 --"
if [ -f 00_MISSION.md ]; then
  mission_commit=$(loop_log -n "$N" --format='%H' -- 00_MISSION.md 2>/dev/null | head -1 || true)
  mission_audit=""
  if [ -n "${mission_commit:-}" ]; then
    while IFS="$(printf '\t')" read -r sha subject; do
      [ -z "${sha:-}" ] && continue
      [ "$sha" = "$mission_commit" ] && break
      case "$subject" in
        "[監査]"*MISSION*) mission_audit="$sha"; break ;;
      esac
    done <<EOF
$(loop_log -n "$N" --format='%H%x09%s' 2>/dev/null || true)
EOF
  fi
  if [ -n "${mission_audit:-}" ]; then
    echo "[緑] MISSION変更は監査commit ${mission_audit}で承認突合済み"
  elif [ -n "${mission_commit:-}" ]; then
    red "直近${n}commit内の00_MISSION.md変更に、後続のMISSION監査commitがない。変更記録欄の人間承認と突合せよ"
  else
    echo "[緑] MISSIONへの変更なし"
  fi
else
  echo "[黄] 00_MISSION.mdが存在しない(初回セットアップ未了なら正常)"
fi

# --- 配車計算(03_DISPATCH.mdの配車規則と同一ロジック。赤はどの計器でも監査へ) ---
echo ""
verdict="実行"; rule="規則5(強制規則非該当→現マイルストーンの実行)"
if [ "$RED" -eq 1 ]; then
  verdict="監査"; rule="規則2(計器に赤あり)"
elif [ "${over_budget}" -eq 1 ]; then
  verdict="監査"; rule="規則3(フェーズ予算超過)"
elif [ -n "${wn:-}" ] && [ -n "${wt:-}" ] && [ "$wn" -ge "$wt" ]; then
  verdict="監査"; rule="規則4(再計画トリガー到達)"
fi
echo "== 配車: ${verdict}番(根拠: ${rule}) =="
echo "   注記: セッション初回はこの判定に関わらず偵察番(規則1)。"
echo "   フェーズ完了条件の充足を申告するターンは監査番(規則3)——充足はスクリプトから判定不能。"
