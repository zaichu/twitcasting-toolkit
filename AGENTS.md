# AGENTS.md

このファイルは Codex 用の入口です。作業時は先に `./CLAUDE.md` を読み、そこから参照される `.claude/rules/*.md` を適用してください。

## 優先ルール

- 日本語で簡潔に回答する
- 変更前に既存構成を確認する
- 変更はユーザー依頼の範囲に限定する
- `npm test`, `npm run typecheck`, `npm run build` を優先して検証する
- 未コミットのユーザー変更を勝手に戻さない
- TwitCasting 外へ権限や content script を広げない
- 取り消しにくい操作には確認、回数上限、遅延を入れる
- 実装は実装エージェントに委譲する。役割(実装・設計・統合)の担当割り当ては `docs/agent-roles.md` を正本とする
- 統合担当が直接実装してよいのは、ユーザーが明示した場合、または運用ルール・ドキュメント・handoff 文面の小変更に限る
- ファイル編集前に `git status --short --branch` で作業ブランチを確認し、`main` なら短期ブランチまたは worktree を作ってから進める
- 実装委譲する作業は原則 `/tmp/twitcasting-toolkit-<topic>` の worktree 上で行う
