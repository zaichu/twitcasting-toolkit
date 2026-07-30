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
- 原則として Codex は設計・テスト観点整理・Claude への実装依頼・実装後レビューを担当し、実装は Claude に委譲する
- 例外は、ユーザーが Codex 実装を明示した場合、または運用ルール・ドキュメント・handoff 文面の小変更に限る
- ファイル編集前に `git status --short --branch` で作業ブランチを確認し、`main` なら短期ブランチまたは worktree を作ってから進める
- Claude に実装委譲する作業は原則 `/tmp/twitcasting-toolkit-<topic>` の worktree 上で行う
