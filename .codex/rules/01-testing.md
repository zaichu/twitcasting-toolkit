# テスト・検証ルール

## 標準検証

- 型変更後は `npm run typecheck`
- ロジック変更後は `npm test`
- ビルド構成変更後は `npm run build`
- Chrome 拡張として確認するときは `dist/` を「パッケージ化されていない拡張機能」として読み込む
- WSL で開発している場合、Windows 側ブラウザに `\\wsl.localhost\...` の UNC パスを直接指定すると host_permissions が認識されないことがあるため、`dist/` を Windows 側ローカルドライブへコピーしてから読み込む
- 手動確認は `https://twitcasting.tv/` 配下のページで行う
- `npm install` 後は `.githooks` の pre-commit(typecheck/test)・pre-push(build/content script バンドル検証)が自動で有効になる。フックが失敗したまま `--no-verify` で回避しない

## 確認観点

- manifest が `dist/manifest.json` に出力されること
- popup HTML と content script の参照パスが manifest と一致すること
- TwitCasting 以外のページでは popup が対象外として扱えること
- checkbox 操作後にページ側イベントが発火されること
- item sender は候補 0 件、候補あり、実行キャンセル、回数上限を確認すること
