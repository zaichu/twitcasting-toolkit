# 全体開発ルール

## 言語・表現

- 日本語で回答する
- コードコメントは、必要な場合のみ日本語で書く
- 変数名・関数名・型名は英語で書く

## Agent 分担

- 役割(実装・設計・統合)の担当割り当ては `docs/agent-roles.md` を正本とする
- 実装は実装エージェントに委譲する。委譲の手順・依頼テンプレートはユーザーレベルの `agent-delegation` skill を正本とする
- 統合担当が直接実装してよいのは、ユーザーが明示した場合、または運用ルール・ドキュメント・handoff 文面の小変更に限る
- ファイル編集前に `git status --short --branch` で作業ブランチを確認し、`main` なら短期ブランチまたは worktree を作ってから進める
- 実装委譲する作業は原則 `/tmp/twitcasting-toolkit-<topic>` の worktree 上で行う

## 構成方針

- 拡張機能の manifest 正本は `public/manifest.json`
- popup は `src/popup/` に集約する
- content script は `src/content.ts` に集約する
- popup と content script で共有する型は `src/extensionTypes.ts` に置く
- storage 操作は `src/storage.ts` に集約する
- TwitCasting の機能単位で UI と message type を分ける

## 実装方針

- Chrome Extension Manifest V3 の制約を守る
- `chrome.*` API は Promise 化できる箇所でも、型と失敗時の扱いを明確にする
- ページ DOM を操作する処理は disabled 要素を変更しない
- DOM 更新後は必要に応じて `input` / `change` イベントを発火する
- UI は popup の限られた幅で文字がはみ出さないようにする
- アイテム送信のような取り消しにくい操作は、実行前確認、最大回数、クリック間隔を必須にする

## 非対象

- ユーザーが明示しない限り、外部サービス連携を追加しない
- ユーザーが明示しない限り、収集したページ情報を外部送信しない
- TwitCasting の制限回避、課金回避、認可回避を目的にした機能は実装しない
