# Git・ブランチルール

このドキュメントを、このリポジトリの Git ブランチ運用の基準とする。

## ブランチ戦略

- 長期ブランチは `main` のみ
- `develop` は使わない
- 作業は `main` から短期ブランチを作って行う
- `main` への直接コミット・直接 push は禁止
- 1 機能・1 タスクにつき 1 ブランチ
- マージ後は作業ブランチをローカル/リモート両方で削除する

## 作業ブランチ名

- `feature/<topic>`
- `fix/<topic>`
- `refactor/<topic>`
- `docs/<topic>`
- `chore/<topic>`
- `hotfix/<topic>`

## worktree 運用

- 大きめの実装や Claude に実装を委譲するタスクでは、専用 `git worktree` を作る
- repo ルートの `main` はレビュー/統合用に clean に保つ
- worktree の配置先は `/tmp/<repo>-<topic>` のような一時パスを標準とする
- 1 作業ブランチ = 1 worktree を守る

## コミットルール

- `git add .` / `git add -A` は使わず、`git add <path>` または `git add -p` を使う
- 1 コミット = 1 目的
- コミットメッセージは日本語で書く

## コミットメッセージ形式

```text
<種別>: <変更内容の要約>

<詳細説明（任意）>
```

## 種別

- `feat`: 新機能
- `fix`: バグ修正
- `refactor`: リファクタリング
- `docs`: ドキュメント
- `test`: テスト
- `chore`: ビルド・設定変更

## PR とマージ

- PR は作業ブランチから `main` へ作成する
- タイトルと説明は日本語で、変更内容とテスト結果を明記する
- マージ方式は `Squash and merge` を標準とする
- マージ後は `main` を更新して作業ブランチを削除する

## 標準フロー

```bash
git switch main
git pull --ff-only origin main
git worktree add -b feature/<topic> /tmp/twitcasting-toolkit-<topic> main
cd /tmp/twitcasting-toolkit-<topic>
git add -p
git commit -m "feat: <変更内容の要約>"
git push -u origin feature/<topic>
gh pr create --base main --head feature/<topic>
```

## 禁止事項

- `main` への直接コミット / 直接 push
- 1 つの作業ブランチに複数タスクを混在させること
- 不要な `--force` push
- squash merge 済み・remote 削除済み・worktree 削除済みの短期ブランチ cleanup 以外で `git branch -D` を使うこと
