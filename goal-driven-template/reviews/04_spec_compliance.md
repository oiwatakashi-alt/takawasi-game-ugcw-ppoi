# テンプレート公式仕様適合性レビュー

## 対象
- 6ファイル: README.md, 00_CONSTITUTION.md, 01_PLAN.md, 02_GOAL.md, 03_WORKFLOW_STATIONS.md, 04_STATE.md
- 適用対象: OpenAI Codex goalモード + Claude Code (/goal /loop /batch)

---

## 適合している点

### (1) ゴール文の構造と条件駆動
- **テンプレ記述(02_GOAL.md L26-29)**  
  「曖昧になったら場当たりの追加指示でなく、ゴール文自体を締め直して再設定」「目標1つ・停止条件1まとまり」
- **公式仕様**(Claude Code: [Keep Claude working toward a goal](https://code.claude.com/docs/en/goal))  
  「A condition that holds up across many turns usually has: One measurable end state」「write the condition as something Claude's own output can demonstrate」
- **判定**: 適合 ✓

### (2) 4000字制限
- **テンプレ記述**: 02_GOAL.md で雛形を提示し、条件文に明示的な制限言及はなし
- **公式仕様**(Codex: [/goal specifications](https://developers.openai.com/codex/cli/slash-commands); Claude Code: [/goal](https://code.claude.com/docs/en/goal))  
  「Goal objectives must be non-empty and at most 4,000 characters」「The condition can be up to 4,000 characters」
- **判定**: 適合(暗黙) ✓  
  実装段階で4000字以内に収まるサイズの雛形提示なので問題なし。明示的な記述があると尚良い。

### (3) 小モデル(Haiku)での評価
- **テンプレ記述**: 02_GOAL.md に「判定モデルが条件評価」と記述
- **公式仕様**(Claude Code [/goal evaluation](https://code.claude.com/docs/en/goal))  
  「the condition and the conversation so far are sent to your configured small fast model, which defaults to Haiku」
- **判定**: 適合 ✓

### (4) /loop の間隔構文
- **テンプレ記述(02_GOAL.md L50-51)**  
  「時間駆動(巡回型の整備・監視向け): `/loop [間隔] [プロンプト]`」
- **公式仕様**(Claude Code [/loop](https://code.claude.com/docs/en/scheduled-tasks))  
  「The interval can lead the prompt as a bare token like 30m, or trail it as a clause like every 2 hours. Supported units are s for seconds, m for minutes, h for hours, and d for days.」
- **判定**: 適合 ✓

### (5) /batch の worktree 分割
- **テンプレ記述(02_GOAL.md L54; 03_WORKFLOW_STATIONS.md L72)**  
  「並列レーン: 独立した縦切りが複数あるとき `/batch`(worktree分割+並列PR)」
- **公式仕様**(Claude Code: [Common workflows - Run parallel sessions with worktrees](https://code.claude.com/docs/en/common-workflows); [Worktrees](https://code.claude.com/docs/en/worktrees))  
  「For a large change that spans the codebase, /batch decomposes it into independent units and runs each in its own worktree. Claude Code includes a set of bundled skills that are available in every session unless disabled with the disableBundledSkills setting, including /code-review, /batch, /debug, /loop, and /claude-api.」
- **判定**: 適合 ✓

### (6) ターンごとの commit と STATE 更新
- **テンプレ記述(00_CONSTITUTION.md L18; 02_GOAL.md L19)**  
  「ターンごとにcommitし、04_STATE.mdを現在形に更新する」
- **公式仕様**(Codex: [Follow a goal](https://developers.openai.com/codex/use-cases/follow-goals))  
  「Codex records facts in git: what changed, who changed it when」; Codex 公式前提は git リポジトリの使用
- **判定**: 適合 ✓

---

## 不適合・怪しい仮定

### (a) 03_WORKFLOW_STATIONS.md のファイル「毎ターン読む」前提の問題

#### 問題
- **テンプレ記述(00_CONSTITUTION.md L4-5)**  
  「毎ターン自動で読まれる前提なので薄く保つ。手順の詳細は `03_WORKFLOW_STATIONS.md`」
- **テンプレ記述(00_CONSTITUTION.md L15-16)**  
  「04_STATE.md を読む(セッション初回は偵察番から)」「03_WORKFLOW_STATIONS.md の配車規則で今回の番を1つ宣言する」

#### 公式仕様と現実
- **Claude Code**(Memory: [How Claude remembers your project](https://code.claude.com/docs/en/memory))  
  「CLAUDE.md and CLAUDE.local.md files in the directory hierarchy above the working directory are loaded in full at launch. Files in subdirectories load on demand when Claude reads files in those directories. ... The first 200 lines or 25KB of MEMORY.md, whichever comes first, load at the start of each session.」
  
  - CLAUDE.md は起動時に全文読み込み
  - MEMORY.md は最初の 200 行または 25KB のみ読み込み
  - 専用ファイルの自動読込は保証されない

- **Codex**(AGENTS.md: [Custom instructions with AGENTS.md](https://developers.openai.com/codex/guides/agents-md))  
  「Codex builds an instruction chain when it starts (once per run; in the TUI this usually means once per launched session). ... Codex skips empty files and stops adding files once the combined size reaches the limit defined by `project_doc_max_bytes` (32 KiB by default).」
  
  - セッション開始時に1回だけ読み込み
  - ターンごとの再読込なし
  - 32KiB の上限あり

#### 修正案
1. **03_WORKFLOW_STATIONS.md をCLAUDE.md内に import する**  
   ```markdown
   # CLAUDE.md
   @03_WORKFLOW_STATIONS.md
   @00_CONSTITUTION.md
   ```
   または `@path` 構文で埋め込む。

2. **04_STATE.md は毎ターン冒頭に明示的に Read する**  
   ゴール文に「Each turn: read 04_STATE.md first, then declare your station」と明記。

3. **サイズ制限に収まるよう構造化**  
   - 03_WORKFLOW_STATIONS.md を「配車規則」(短縮版)と「詳細」に分割
   - 詳細版を `.claude/rules/` に path-scoped で配置

#### 影響度
**高** — 毎ターン読込が保証されない場合、ターン途中でルールを見落とす可能性

#### 出典
- Claude Code: https://code.claude.com/docs/en/memory
- Codex: https://developers.openai.com/codex/guides/agents-md

---

### (b) 00_CONSTITUTION.md の自動読込前提

#### 問題
- **テンプレ記述(00_CONSTITUTION.md 冒頭)**  
  「AGENTS.md(Codex)/ CLAUDE.md(Claude Code)にコピーして使う。毎ターン自動で読まれる前提」

#### 公式仕様と現実
- **Codex**(AGENTS.md)  
  「Codex builds an instruction chain when it starts (once per run)」  
  → セッション開始時のみ。ターンごとの再読込なし。

- **Claude Code**(CLAUDE.md)  
  「CLAUDE.md and CLAUDE.local.md files in the directory hierarchy above the working directory are loaded in full at launch.」  
  → セッション開始時のみ。

#### 修正案
- テンプレで「セッション開始時に1回だけ読まれる」と明記
- 「ターンごとに STATE.md を明示的に Read する」ワークフローを強制

#### 影響度
**中** — 実装上の誤解を招く（セッション開始時の読込のみなのに「毎ターン」と解釈される）

#### 出典
- Claude Code: https://code.claude.com/docs/en/memory
- Codex: https://developers.openai.com/codex/guides/agents-md

---

### (c) /batch の記述精度

#### 問題
- **テンプレ記述(02_GOAL.md L54; 03_WORKFLOW_STATIONS.md L72)**  
  「Claude Code: `/batch` がworktree分割+並列サブエージェントを公式サポート」

#### 公式仕様と現実
- **Claude Code**(Bundled skills and worktrees)  
  `/batch` は **bundled skill**(スキル)であり、セッションコマンドではない。
  
  「Claude Code includes a set of bundled skills that are available in every session unless disabled with the disableBundledSkills setting, including /code-review, /batch, /debug, /loop, and /claude-api.」
  
  「/batch is a skill that has Claude split one large change into 5 to 30 worktree-isolated subagents that each open a pull request. It's a packaged use of subagents and worktrees, not a separate coordination style.」

#### 修正案
- `/batch` は「`/loop` 同様に使うコマンド」ではなく「デコンポジション用スキル」と位置付ける
- テンプレに「独立した縦切りが複数あり、単一エージェントが1本の枝を持つ場合に `/batch` を利用」と明記

#### 影響度
**低〜中** — 実装上は動くが、ユーザーの心的モデルに誤解を招く可能性

#### 出典
- Claude Code: https://code.claude.com/docs/en/common-workflows
- Claude Code: https://code.claude.com/docs/en/skills

---

### (d) 並列レーン「所有権の重複禁止」の根拠

#### 問題
- **テンプレ記述(03_WORKFLOW_STATIONS.md L71-74)**  
  「並列レーン: 独立した縦切りが複数あるときだけ使う。所有権(ファイル・ディレクトリ)を重複させない。」

#### 公式仕様との関連
- **Claude Code**(Worktrees)  
  「Running each Claude Code session in its own worktree means edits in one session never touch files in another, so you can have Claude building a feature in one terminal while fixing a bug in a second.」

これは **技術的事実**(worktree が分離）であり、「所有権を重複させない」は **設計推奨** に過ぎない。

#### 修正案
- 「所有権の重複を避ける」を「推奨」から「必須」に明確化
- 理由: worktree 間で同一ファイルを編集した場合、マージ競合が生じる

#### 影響度
**中** — マージ衝突を避けるための重要なルール

#### 出典
- Claude Code: https://code.claude.com/docs/en/worktrees

---

## 未確認事項

### (1) Codex `/goal pause` / `/goal resume` の挙動保証
- **テンプレ記述(02_GOAL.md L36)**  
  「確認 `/goal` / 一時停止 `/goal pause` / 再開 `/goal resume` / 解除 `/goal clear`」

- **公式仕様** で確認できた:
  - Codex: `/goal pause`, `/goal resume`, `/goal clear` 存在を確認
  - Claude Code: `/goal clear` 明記, pause/resume は記載なし

**結論**: Claude Code では `/goal pause` / `/goal resume` の公式サポート状況が **未確認**。確認が必要。

### (2) Codex /plan-mode の /goal 連携精度
- **テンプレ記述(02_GOAL.md L38)**  
  「大きめフェーズは事前に `/plan-mode` で計画レビューしてからgoal化すると精度が上がる」

- **根拠**: Codex の `/plan-mode` の公式仕様は閲覧可能だが、goal との組み合わせ検証事例は **未確認**。推奨というより経験則の可能性。

### (3) テスト数の単調増加「正常」の根拠
- **テンプレ記述(03_WORKFLOW_STATIONS.md L44; 01_PLAN.md L47)**  
  「テスト数はフェーズを通じて単調増加が正常」「テスト数が2品質番連続で増えていなければ異常」

- **公式仕様**: テスト駆動開発のベストプラクティスは一般的だが、Claude Code/Codex の公式仕様では「テスト数の増加が保証される」という記述は **未確認**。

### (4) `セッション再起動プロトコル(03_WORKFLOW_STATIONS.md L63-67)` の official サポート
- **テンプレ記述**  
  「同じことを二度探した / 台帳にない事実を記憶から書きそうになった」を triggers として再起動

- **公式仕様**: Claude Code の context compaction 後の動作は確認できたが、「再起動トリガー」としての位置づけは **未確認**。

---

## まとめ

### 強い適合
- ゴール文の構造 ✓
- 4000字制限 ✓
- /loop 構文 ✓
- /batch worktree 分割 ✓

### 要修正
1. **毎ターン読込前提を廃止** — CLAUDE.md import + 明示的 STATE.md Read に変更
2. **/batch の位置づけ明確化** — スキルとしての性質を強調
3. **並列レーン所有権ルール厳格化** — 推奨から必須に

### 未確認
- Claude Code `/goal pause` / `/goal resume`
- Codex `/plan-mode` との goal 組み合わせ効果
- テスト数単調増加の公式保証
- セッション再起動トリガーの official 仕様化

---

## 出典 URL

### Claude Code Official
- [Keep Claude working toward a goal](https://code.claude.com/docs/en/goal)
- [How Claude remembers your project](https://code.claude.com/docs/en/memory)
- [Run parallel sessions with worktrees](https://code.claude.com/docs/en/worktrees)
- [Extend Claude with skills](https://code.claude.com/docs/en/skills)
- [Common workflows](https://code.claude.com/docs/en/common-workflows)
- [Run prompts on a schedule](https://code.claude.com/docs/en/scheduled-tasks)

### Codex Official
- [Slash commands in Codex CLI](https://developers.openai.com/codex/cli/slash-commands)
- [Custom instructions with AGENTS.md](https://developers.openai.com/codex/guides/agents-md)
- [Follow a goal](https://developers.openai.com/codex/use-cases/follow-goals)

