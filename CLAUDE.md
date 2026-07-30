# CLAUDE.md

このファイルは、この TwitCasting 拡張機能プロジェクト全体のガイドです。

## 読み込み場所

- プロジェクト全体: `./CLAUDE.md`
- Codex 用入口: `./AGENTS.md`
- ルール詳細: `./.claude/rules/*.md`
- 個人設定: `./CLAUDE.local.md`（gitignore 推奨）

## 共通ルール

- 日本語で回答する
- 思考過程・内部推論・検討ログは出力しない
- 出力は必要最小限にする
- 指示されていない改善・リファクタを混在させない
- 情報不足時の質問は 1 つだけにする

## Codex / Claude 分担

- 原則として Codex は設計、テスト観点整理、Claude への実装依頼、実装後レビューを担当する
- 原則として Claude は Codex から渡された依頼文に基づく実装を担当する
- Codex が直接実装してよい例外は、ユーザーが明示した場合、または運用ルール・ドキュメント・handoff 文面の小変更に限る
- Codex から Claude に実装を渡す場合は `.claude/skills/codex-claude-handoff/SKILL.md` を使う
- Codex はファイル編集前に `git status --short --branch` で作業ブランチを確認し、`main` なら短期ブランチまたは worktree を作ってから進める
- Claude に実装委譲する作業は原則 `/tmp/twitcasting-toolkit-<topic>` の worktree 上で行う

## Agent Assets

- repo 内の agent 設定の正本は `./.claude` とする
- `./.codex` は Codex 用に `.claude` と同じ内容を持つ入口として維持する
- この sandbox では symlink が編集を阻害するため、`shoken-webapp` と違い実ディレクトリで同期する
- skills は `shoken-webapp` を参考に、Chrome 拡張機能開発に関係するものだけを置く
- backend / DB / deploy / J-Quants など、この repo に関係しない skills は追加しない

## プロジェクト方針

- このリポジトリは TwitCasting 向け Manifest V3 Chrome 拡張機能
- popup UI は React + Vite で実装する
- content script は機能別ルーターとして扱い、機能追加時は message type を明確に分ける
- 設定は `chrome.storage.sync` に保存する
- TwitCasting 外への host permission 追加は禁止。必要な場合は理由を README と security rule に残す
- アイテム送信など取り消しにくい操作は、回数上限・実行前確認・遅延を必ず入れる

## コマンド

- `npm run dev` - Vite 開発サーバー
- `npm test` - Vitest 単体テスト
- `npm run typecheck` - TypeScript 型検査
- `npm run build` - 拡張機能を `dist/` にビルド

## 参照ルール

1. `.claude/rules/00-general.md`
2. `.claude/rules/01-testing.md`
3. `.claude/rules/02-security.md`
4. `.claude/rules/03-git.md`

## 参照 skills

- `.claude/skills/frontend-build-test/SKILL.md`
- `.claude/skills/frontend-design/SKILL.md`
- `.claude/skills/frontend-refactor/SKILL.md`
- `.claude/skills/webapp-testing/SKILL.md`
- `.claude/skills/pr-review/SKILL.md`
- `.claude/skills/pr-workflow/SKILL.md`
- `.claude/skills/git-pushing/SKILL.md`
- `.claude/skills/security-review/SKILL.md`
- `.claude/skills/systematic-debugging/SKILL.md`
- `.claude/skills/test-driven-development/SKILL.md`
- `.claude/skills/codex-claude-handoff/SKILL.md`
