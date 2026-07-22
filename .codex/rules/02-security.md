# セキュリティルール

## 機密情報

- API キー、トークン、パスワード、個人情報をコミットしない
- ページ上のフォーム値や URL 全体を外部へ送信しない
- debug log にページ内容や個人情報を出さない

## 拡張機能権限

- 権限は必要最小限にする
- `host_permissions` を広げる場合は README に理由を書く
- `scripting` は TwitCasting タブで content script を復旧注入する用途に限定する
- content script は TwitCasting の HTTP/HTTPS ページに限定する
- `eval` や remote code execution に該当する実装は禁止
- TwitCasting 外のページに content script を注入しない

## 取り消しにくい操作

- アイテム送信など、消費・課金・取り消し不可になり得る操作は自動実行しない
- 実行前に popup 上で対象名と回数を確認する
- 回数上限とクリック間隔を実装する
- 実装時は対象 DOM を直接固定しすぎず、画面変更時に失敗として止まる設計にする

## storage

- `chrome.storage.sync` にはサイト別ルールなど最小限の設定だけ保存する
- ページ本文、フォーム内容、認証情報を保存しない
