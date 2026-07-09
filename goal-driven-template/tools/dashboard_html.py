#!/usr/bin/env python3
"""dashboard_html.py — プロジェクトダッシュボード DASHBOARD.html を生成する。
使い方(プロジェクトルートで): python3 tools/dashboard_html.py
統合表示: ①現在地(04_STATE) ②人間操作TODO(hub/humanops/open) ③ユーザー資料の状態
(user/drop・sources・rejected+反証記録)。ユーザーは投入(user/drop)と確認(この1枚)だけでよい。
依存: 標準ライブラリのみ。起票・消し込み・資料の状態遷移のたびに再生成すること。
"""
import html
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # どこから実行してもよい(自己位置特定)
OUT = ROOT / "DASHBOARD.html"
STATE = ROOT / "04_STATE.md"
HO_OPEN = ROOT / "hub" / "humanops" / "open"
U_DROP = ROOT / "user" / "drop"
U_SRC = ROOT / "user" / "sources"
U_REJ = ROOT / "user" / "rejected"

URL_RE = re.compile(r"https?://[^\s\)\]>」]+")
GROUP_ORDER = ["課金", "認証", "契約", "行政", "その他"]

def esc(s):
    return html.escape(s)

def linkify(escaped):
    return URL_RE.sub(lambda m: f'<a href="{m.group(0)}" target="_blank">{m.group(0)}</a>', escaped)

def ls_files(d):
    if not d.is_dir():
        return []
    return sorted(p for p in d.iterdir() if p.is_file() and not p.name.startswith("."))

# ---------- ①現在地(04_STATEの「## 現在地」節を抜く) ----------
state_html = "<p>04_STATE.md が見つからない/現在地節なし</p>"
if STATE.is_file():
    lines = STATE.read_text(encoding="utf-8", errors="replace").splitlines()
    buf, inside = [], False
    for l in lines:
        if l.startswith("## "):
            inside = l.strip() == "## 現在地"
            continue
        if inside and l.strip().startswith("- "):
            buf.append(f"<li>{linkify(esc(l.strip()[2:]))}</li>")
    if buf:
        state_html = "<ul>" + "".join(buf) + "</ul>"

# ---------- ②人間操作TODO ----------
def parse_ho(path):
    text = path.read_text(encoding="utf-8", errors="replace")
    title = next((l.lstrip("# ").strip() for l in text.splitlines() if l.startswith("# ")), path.stem)
    fields = {}
    for l in text.splitlines():
        m = re.match(r"^- ([^:]+):\s*(.*)$", l)
        if m:
            fields[m.group(1).strip()] = m.group(2).strip()
    primary = None
    if "一次リンク" in fields:
        m = URL_RE.search(fields["一次リンク"])
        primary = m.group(0) if m else None
    if not primary:
        m = URL_RE.search(text)
        primary = m.group(0) if m else None
    return title, fields, primary, text

ho_items = []
for i, p in enumerate(ls_files(HO_OPEN)):
    if p.suffix != ".md":
        continue
    title, fields, primary, text = parse_ho(p)
    g = fields.get("種別", "その他") or "その他"
    if g not in GROUP_ORDER:
        g = "その他"
    ho_items.append({"id": f"ho{i}", "t": title, "f": fields, "u": primary, "x": text, "g": g, "n": p.name})
ho_groups = {g: [x for x in ho_items if x["g"] == g] for g in GROUP_ORDER}
ho_groups = {g: v for g, v in ho_groups.items() if v}

ho_tree, ho_cards = [], []
for g, its in ho_groups.items():
    lis = []
    for it in its:
        due = it["f"].get("期限/緊急度", "")
        lis.append(f'<li><a href="#{it["id"]}">{esc(it["t"])}</a>'
                   + (f' <span class="due">{esc(due)}</span>' if due else "") + "</li>")
    ho_tree.append(f'<details open><summary><b>{esc(g)}</b> ({len(its)}件)</summary><ul>{"".join(lis)}</ul></details>')
    for it in its:
        btn = (f'<a class="go" href="{esc(it["u"])}" target="_blank">手続きを開く →</a>'
               if it["u"] else '<span class="warn">一次リンク未記入(起票を直すこと)</span>')
        why = it["f"].get("なぜ必要", "")
        ho_cards.append(f"""<div class="card" id="{it["id"]}"><h4>{esc(it["t"])}</h4>
{f'<p class="meta">なぜ必要: {esc(why)}</p>' if why else ""}{btn}
<details><summary>詳細(手順・事前情報・完了確認)</summary><pre>{linkify(esc(it["x"]))}</pre></details>
<p class="src">起票: {esc(it["n"])} <a href="#top">↑戻る</a></p></div>""")

ho_html = ("\n".join(ho_tree) + "\n" + "\n".join(ho_cards)) if ho_items else "<p>未処理の人間操作はありません。</p>"

# ---------- ③ユーザー資料 ----------
drop_files = ls_files(U_DROP)
src_files = ls_files(U_SRC)
rej_all = ls_files(U_REJ)
rej_rebuttals = {p.name: p for p in rej_all if p.name.endswith("_反証.md")}
rej_files = [p for p in rej_all if not p.name.endswith("_反証.md")]

drop_html = ("<ul>" + "".join(f"<li>{esc(p.name)}</li>" for p in drop_files) + "</ul>"
             ) if drop_files else "<p>未処理の投入なし。資料は user/drop/ に置くだけで次のループが拾います。</p>"
src_html = ("<ul>" + "".join(f"<li>{esc(p.name)}</li>" for p in src_files) + "</ul>"
            ) if src_files else "<p>昇格済み資料はまだありません。</p>"

rej_cards = []
for p in rej_files:
    reb = rej_rebuttals.get(p.stem + "_反証.md")
    reb_html = (f"<details open><summary>反証・反論の記録</summary><pre>{linkify(esc(reb.read_text(encoding='utf-8', errors='replace')))}</pre></details>"
                if reb else '<p class="warn">反証記録が未添付(規約違反——起票エージェントに差し戻し)</p>')
    rej_cards.append(f'<div class="card rej"><h4>{esc(p.name)}</h4>{reb_html}'
                     f'<p class="meta">応答するには: 裏付け・異議を user/drop/ に投入(異議も検証対象)</p></div>')
rej_html = "\n".join(rej_cards) if rej_files else "<p>再検討中の資料はありません。</p>"

# ---------- 組み立て ----------
now = datetime.now().strftime("%Y-%m-%d %H:%M")
OUT.write_text(f"""<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8">
<title>プロジェクトダッシュボード</title>
<style>
body{{font-family:sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6}}
h1{{font-size:1.3rem}} h2{{font-size:1.1rem;border-bottom:2px solid #ddd;padding-bottom:.2rem;margin-top:2rem}}
h4{{margin:.2rem 0}}
.sec{{background:#f7f7f4;border:1px solid #ddd;border-radius:8px;padding:.8rem 1.2rem;margin:1rem 0}}
.card{{border:1px solid #ccc;border-radius:8px;padding:.8rem 1.2rem;margin:.8rem 0;background:#fff}}
.rej{{border-color:#c96}}
.meta{{color:#555;font-size:.9rem;margin:.3rem 0}} .due{{color:#b00;font-size:.85rem;font-weight:bold}}
.go{{display:inline-block;background:#1a6f3c;color:#fff;padding:.5rem 1.2rem;border-radius:6px;
  text-decoration:none;font-weight:bold;margin:.3rem 0}}
.warn{{color:#b00;font-weight:bold}}
pre{{white-space:pre-wrap;background:#f6f6f6;padding:.8rem;border-radius:6px;font-size:.85rem}}
.src{{color:#999;font-size:.8rem}}
nav a{{margin-right:1rem}}
</style></head><body id="top">
<h1>プロジェクトダッシュボード</h1>
<p class="meta">生成: {now} / 投入は user/drop/ へ。確認はこの1枚。</p>
<nav><a href="#state">現在地</a><a href="#ho">人間操作TODO ({len(ho_items)}件)</a><a href="#user">ユーザー資料
(投入{len(drop_files)}・昇格{len(src_files)}・再検討{len(rej_files)})</a></nav>

<h2 id="state">現在地(04_STATEより)</h2>
<div class="sec">{state_html}</div>

<h2 id="ho">人間操作TODO — {len(ho_items)}件</h2>
<div class="sec">{ho_html}</div>

<h2 id="user">ユーザー資料の状態</h2>
<div class="sec"><h4>投入(未処理: {len(drop_files)}件)</h4>{drop_html}
<h4>昇格済みソース({len(src_files)}件)</h4>{src_html}
<h4>再検討(却下: {len(rej_files)}件)——反証・反論の記録</h4>{rej_html}</div>

</body></html>
""", encoding="utf-8")

print(f"DASHBOARD.html 生成完了: 人間操作{len(ho_items)}件 / 投入{len(drop_files)}・昇格{len(src_files)}・再検討{len(rej_files)}")
