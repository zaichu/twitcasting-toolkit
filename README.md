# TwitCasting Toolkit

TwitCasting の操作を補助するための Chrome 拡張機能です。単一機能の拡張ではなく、TwitCasting 向けの小さな便利ツールを追加していく前提のプロジェクトです。

## 現在のツール

- チェックボックス操作
  - 現在ページのチェックボックス数、選択中、無効状態を表示
  - 全選択、全解除、反転
  - ホスト別に読み込み時の自動選択/解除を保存
- アイテム送信補助
  - TwitCasting のアイテム一覧から送信候補を取得
  - popup のアイコン付きリストから対象を選ぶ
  - 対象アイテムを開き、「ポイントを使って送る」ボタンを押す
  - 指定回数だけ送信操作を試行
  - 最大 20 回、クリック間隔 300-5000ms
  - ポイント不足が表示された場合は処理を中断
- 無料コイン回復通知
  - ポイントページの「あと◯時間◯分で回復」表示から回復予定時刻を算出し、その時刻付近で 1 回だけ確認
  - 回復待ちでない間、または予定時刻を算出できない間は 30 分間隔でバックグラウンド確認
  - ブラウザ起動時にも即座に確認するため、起動時点で既に回復済みだった場合も通知される
  - 「回復待ち」表示が解消されたタイミングで OS のデスクトップ通知を表示

## 方針

- 対象サイトは TwitCasting のみに限定する
- 機能は popup から明示操作したときだけ実行する
- アイテム送信のような取り消しにくい操作には、回数上限と状態検出を入れる
- TwitCasting の制限回避、課金回避、認可回避を目的にした機能は扱わない

## 権限

- `activeTab`: popup から現在の TwitCasting タブへ操作を送るため
- `scripting`: content script がまだ入っていない既存タブへ、popup から復旧注入するため
- `storage`: ホスト別の設定、ログイン中ユーザー ID、直近のポイント状態を保存するため
- `alarms`: 無料コイン回復確認をバックグラウンドで定期実行するため
- `notifications`: 無料コインの回復完了をデスクトップ通知するため
- `https://twitcasting.tv/*`, `https://*.twitcasting.tv/*`: TwitCasting 上でのみ content script を動かすため

## 開発

```bash
npm install
npm test
npm run build
```

ビルド後、Chrome の `chrome://extensions` でデベロッパーモードを有効にし、`dist/` を「パッケージ化されていない拡張機能」として読み込んでください。

### WSL 環境での注意

WSL 上でビルドし、Windows 側の Chrome/Vivaldi へ `\\wsl.localhost\...` の UNC パスをそのまま指定して読み込むと、
`manifest.json` の `host_permissions` が正しく認識されず、TwitCasting ページへの content script 注入が行われない
(サイトへのアクセス権が「ありません」と表示される)ことを確認している。WSL 環境で動作確認する場合は、
`dist/` を Windows 側のローカルドライブ(例: `C:\temp\...`)へコピーしてから読み込むこと。

## Git hooks

`npm install` を実行すると `prepare` スクリプトが `core.hooksPath` を `.githooks` に設定し、以下が自動実行されます。

- `pre-commit`: `npm run typecheck` / `npm test`
- `pre-push`: `npm run build` と、content script バンドルに ESM `import`/`export` 構文が混入していないかの検証(`scripts/checkContentScriptBundle.mjs`)

content script は classic script として読み込まれるため、popup や background と共有するモジュールを増やすと Rollup のコード分割で `import` 文が紛れ込み、ビルドは成功してもブラウザ上で読み込みエラーになることがあります。`pre-push` の検証はこれを push 前に検出します。

## コマンド

- `npm run dev` - popup UI の開発サーバー
- `npm test` - Vitest による単体テスト
- `npm run typecheck` - TypeScript 型検査
- `npm run build` - Chrome 拡張を `dist/` に出力

## 公開パッケージ

Chrome Web Store には `dist/` の中身を zip 化したファイルを提出します。

```bash
npm test
npm run typecheck
npm run package:release
```

公開名は `public/manifest.json` の `name` に合わせて `TwitCasting Toolkit` です。

## Agent ルール

- 正本は `.claude/`
- `.codex/` は同内容の Codex 用入口として維持
- ブランチ運用は `.claude/rules/03-git.md` を参照
- skills は `shoken-webapp` を参考に、フロントエンド拡張機能開発、テスト、PR、Git 操作、セキュリティレビューに関係するものだけを同梱

## ライセンス

MIT License
