# Chrome Web Store Listing

## Extension Name

TwitCasting Toolkit

## Short Description

TwitCasting のチェックボックス操作とアイテム送信を補助するツールキットです。

## Detailed Description

TwitCasting Toolkit は、TwitCasting の操作を少し効率化するための Chrome 拡張機能です。

主な機能:

- 現在ページのチェックボックス状態を確認
- チェックボックスの全選択、全解除、反転
- TwitCasting のアイテム一覧を取得し、アイコン付きリストからアイテムを選択
- 選択したアイテムを指定回数送信
- ポイント不足が表示された場合は送信処理を中断

この拡張機能は TwitCasting のページ上で、ユーザーが popup から明示的に実行した操作だけを行います。TwitCasting の制限回避、課金回避、認可回避を目的にした機能は含みません。

## Category

Productivity

## Language

Japanese

## Permission Justifications

Chrome Web Store の「プライバシーへの取り組み」には以下を入力します。

### activeTab

ユーザーが拡張機能の popup から明示的に実行した操作を、現在開いている TwitCasting タブにだけ送るために使用します。バックグラウンドで任意のタブを読み取ったり操作したりする用途には使用しません。

### scripting

TwitCasting ページ上で、チェックボックス操作やアイテム送信補助に必要なスクリプトを実行するために使用します。既に開いているタブに content script が入っていない場合の復旧注入と、ユーザーが選択したアイテムの送信ダイアログをページ上で開く処理に限定しています。

### storage

ユーザーが選択したチェックボックス自動適用設定を、TwitCasting のホスト別設定として保存するために使用します。保存するのは拡張機能の設定のみで、閲覧履歴、コメント、アイテム送信履歴、個人情報は保存しません。

### Host permissions

`https://twitcasting.tv/*` と `https://*.twitcasting.tv/*` のみを対象にします。TwitCasting ページの DOM 状態確認、アイテム一覧取得、ユーザーが選択した操作の実行に使用します。

## Privacy Notes

- 外部の独自サーバーへデータを送信しません。
- TwitCasting 以外のサイトでは動作しません。
- 保存するデータは、チェックボックス自動適用のホスト別設定のみです。
- アイテム送信は TwitCasting のログイン状態とポイント残高に従って実行されます。

## Release Checklist

- `npm test`
- `npm run typecheck`
- `npm run build`
- `dist/manifest.json` の `name` が `TwitCasting Toolkit`
- `dist/manifest.json` の `version` が Chrome Web Store 上の公開済みバージョンより大きい
- `release/twitcasting-toolkit-2.0.4.zip` を Chrome Web Store にアップロード

## Store Screenshots

Chrome Web Store に指定するスクリーンショット:

- `docs/store-assets/store-screenshot-01-item-sender.png` - 1280x800 PNG
- `docs/store-assets/store-screenshot-02-checkbox.png` - 1280x800 PNG
- `docs/store-assets/store-screenshot-03-safety.png` - 1280x800 PNG
