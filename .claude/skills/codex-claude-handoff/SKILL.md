---
name: codex-claude-handoff
description: "Codex から Claude に修正実装を依頼するときのベースプロンプトを生成する。Use when: バグ修正、レビュー指摘対応、リファクタリング、挙動不一致の調査などを Claude に委譲するとき。依頼文の不足で往復が増える状況を避けたいとき。"
---

# Codex Claude Handoff

## Goal
Claude が最短で実装に着手できる依頼文を作成し、Codex から `claude` CLI で直接渡す。

## Workflow
1. `git status --short --branch` で現在ブランチを確認する。
2. `main` の場合は `.claude/rules/03-git.md` に従い、短期ブランチまたは `/tmp/twitcasting-toolkit-<topic>` worktree を作成してから続ける。
3. 依頼の目的を1文で確定する。
4. 現状の挙動と期待挙動を対で書く。
5. 根拠となるファイルとログを列挙する。
6. 制約と非対象を明記する。
7. 受け入れ条件と確認コマンドを明記する。
8. `references/base_prompt_template.md` のテンプレートに埋め込む。
9. 初回依頼は `claude -p --permission-mode acceptEdits "<依頼文>"` で実行する。
10. 同じタスク・同じブランチで Claude 作業を継続する場合は `claude -c -p --permission-mode acceptEdits "<依頼文>"` を使い、直近セッションの文脈を引き継ぐ。
11. レビュー指摘対応は `claude -c -p --permission-mode acceptEdits "<修正依頼>"` で同じ文脈に渡す。

## Rules
- 曖昧語を避ける。: 「いい感じ」「必要なら」などを使わない。
- 期待結果を検証可能に書く。: 画面表示、レスポンス、テスト結果を具体化する。
- ファイルパスを必ず明示する。: Claude が探索コストをかけないようにする。
- 非対象を明記する。: ついでの変更を防ぐ。
- 実行コマンドを先に渡す。: lint/test/build の実施範囲を固定する。
- `claude` CLI 呼び出し時は原則 `--model` を指定しない。プロジェクト側でモデルを固定せず、Claude CLI やアカウント側のデフォルト/推奨モデル更新に追従しやすくする。ユーザーが明示した場合、または公式に確認した最新/推奨指定がある場合のみ `--model` を使える。

## Output
Claude に渡す最終プロンプトと実行した `claude` コマンドの結果を返す。
