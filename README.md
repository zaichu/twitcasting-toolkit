# TwitCasting Toolkit

TwitCasting の操作を補助するための Chrome 拡張機能です。単一機能の拡張ではなく、TwitCasting 向けの小さな便利ツールを追加していく前提のプロジェクトです。

## 現在のツール

- チェックボックス操作
  - 現在ページのチェックボックス数、選択中、無効状態を表示
  - 全選択、全解除、反転
  - ホスト別に読み込み時の自動選択/解除を保存
- アイテム送信補助
  - ページ内から送信候補になりそうなボタン/リンクを検出
  - popup の選択リストから対象を選ぶ
  - 対象アイテムを開き、「ポイントを使って送る」ボタンを押す
  - 指定回数だけ送信操作を試行
  - 最大 20 回、クリック間隔 300-5000ms
  - 実行前に確認ダイアログを表示

## 方針

- 対象サイトは TwitCasting のみに限定する
- 機能は popup から明示操作したときだけ実行する
- アイテム送信のような取り消しにくい操作には、回数上限と実行前確認を必ず入れる
- TwitCasting の制限回避、課金回避、認可回避を目的にした機能は扱わない

## 権限

- `activeTab`: popup から現在の TwitCasting タブへ操作を送るため
- `scripting`: content script がまだ入っていない既存タブへ、popup から復旧注入するため
- `storage`: ホスト別の設定を保存するため
- `https://twitcasting.tv/*`, `https://*.twitcasting.tv/*`: TwitCasting 上でのみ content script を動かすため

## 開発

```bash
npm install
npm test
npm run build
```

ビルド後、Chrome の `chrome://extensions` でデベロッパーモードを有効にし、`dist/` を「パッケージ化されていない拡張機能」として読み込んでください。

## コマンド

- `npm run dev` - popup UI の開発サーバー
- `npm test` - Vitest による単体テスト
- `npm run typecheck` - TypeScript 型検査
- `npm run build` - Chrome 拡張を `dist/` に出力

## Agent ルール

- 正本は `.claude/`
- `.codex/` は同内容の Codex 用入口として維持
- ブランチ運用は `.claude/rules/03-git.md` を参照
- skills は `shoken-webapp` を参考に、フロントエンド拡張機能開発、テスト、PR、Git 操作、セキュリティレビューに関係するものだけを同梱

## ライセンス

MIT License
