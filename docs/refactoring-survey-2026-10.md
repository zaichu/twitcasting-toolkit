一時的な文書。シリーズの最後の PR で消す。

# リファクタリング調査 (2026-10, Issue #101 段階1)

調査だけ。製品コードは変えていない。

## 確認の前提

- `src/popup/`・Background・`src/content.ts`・`src/extensionTypes.ts`・`src/storage.ts` を読んだ
- アイテム送信の安全装置(最大回数・間隔・確認・ポイント不足の検知)を弱める提案は含めない

## 問題の一覧

| # | 問題 | ファイルパスと行 | 根拠 | 重要度 | 影響範囲 | 変更リスク | 期待効果 | おすすめの順 |
|---|------|-----------------|------|--------|----------|------------|----------|--------------|
| 1 | `storage.ts` が下位レイヤー(`features/pointRecovery`)に依存し、依存方向が逆転している | `src/storage.ts:1-7`、`src/features/pointRecovery/pointRecoveryNotifier.ts:11-12` | スナップショットのキー定数・型を `features` 側が所有し、共通層の `storage.ts` がそれを import している。`pointRecovery` の変更が `storage` に波及する | 低 | `storage.ts`、`pointRecoveryNotifier.ts` とその利用箇所(`background.ts`、content 側ハンドラ) | 低(定数・型の置き場所移動のみ。`src/storage.test.ts` あり) | 依存方向の整理。以後の段階2以降の変更時の見通し改善 | 1 |
| 2 | 拡張機能内メッセージの方式が二重化している(`feature`+`type` と `__type`) | `src/extensionTypes.ts:61-87`、`src/features/pointRecovery/pointRecoveryNotifier.ts:14-34`、`src/content/handlers/router.ts:11-40`、`src/background.ts:153-166` | popup⇔content 間は `feature`+`type` の `ExtensionMessage` で router が未知の組み合わせを拒否する設計。一方 content→background のポイント観測通知は `__type` 単軸の別方式で、background 側に専用リスナーがある。混線の実害は現状ないが、方式追加時に二箇所の規約を意識する必要がある | 低 | background のメッセージ受信部、content 側の通知送信部(`src/content/handlers/itemSender.ts:9-24`) | 中(メッセージ互換に触れる。既存テスト `router.test.ts`、`background.test.ts` あり) | 型・受信経路の一元化。将来の message 追加時の混線防止 | 2 |

## 無料コイン回復通知の確認結果(実害のある欠陥なし。Issue 化しない)

確認した範囲:

- 時刻計算は絶対時刻を使わない。ページ文言の相対時間(「あとX日X時間X分X秒で」)を `parseRemainingMillisecondsFromText`(`src/features/point/pointText.ts:61-83`)で ms 化し、`POINT_RECOVERY_RECHECK_BUFFER_MS`(60 秒)を足して再チェックする方式(`src/features/pointRecovery/pointRecoveryNotifier.ts:93-101`、`src/background.ts:70-80`)。日単位の表記にも対応(`REMAINING_TIME_PATTERN` に日を含む。`src/features/point/pointText.ts:10-11`)。タイムゾーン・日またぎの計算が存在しないため、該当する欠陥はない。クロックのずれがあっても再チェック時刻の前後にしか影響しない
- 重複防止は「回復待ち→解消」の遷移検知のみ(`didPointRecoveryComplete`。`src/features/pointRecovery/pointRecoveryNotifier.ts:77-91`)で、ポイント数比較はしない。fetch 経路・popup 観測経路とも `evaluateAndPersistSnapshot`(`src/background.ts:85-99`)の単一箇所に集約し、判定→通知→保存→次回予約の順で処理する。recheck アラームは同名上書きのため二重予約にならない。watch アラームは既存があれば作らない(`ensureWatchAlarm`。`src/background.ts:134-144`)
- 起動時(`onInstalled`/`onStartup`)は満タンなら前回比較なしで通知する意図的仕様(`src/background.ts:125-129`)で、テスト済み(`src/features/pointRecovery/pointRecoveryNotifier.test.ts:106-124`)。再起動のたびに満タン通知が出るが、仕様として許容範囲と判断し、欠陥として Issue 化しない
- 通知 ID に `Date.now()` を含めるため短時間の往復(回復→再消費→回復)では複数通知が出る(`src/background.ts:52`)。実害は小さいため触らない

## 権限(manifest)の確認結果(削減余地なし)

`public/manifest.json:7-17` の `permissions`(`activeTab`、`alarms`、`notifications`、`scripting`、`storage`)はすべて使用実績あり。`host_permissions` と `content_scripts.matches` は `https://twitcasting.tv/*` と `https://*.twitcasting.tv/*` のみ。`scripting` の用途は MAIN world 注入(`src/popup/mainWorldItemSend.ts:7`)と content script 復旧注入(`src/popup/popupChrome.ts:46-49`)に限定されている。`background.service_worker` の `type: module`(`public/manifest.json:18-21`)は現状の import 構成に必要。削れる権限はない。

## content script の ESM 混入防止の確認結果(仕組みは有効)

- `vite.config.ts:9-23` で `BUILD_TARGET=content` のときだけ content 単独の iife ビルドにし、`package.json:9` の `build` で popup+background と content を分けてビルドする
- `.githooks/pre-push` で `npm run build` 後に `scripts/checkContentScriptBundle.mjs` が `dist/assets/content.js` の行頭 `import`/`export` を検証する(`scripts/checkContentScriptBundle.mjs:7`)
- `src/features/dom/domUtils.ts:1-5` のコメントの通り、content と popup の共有は iife 内包される形で壊れない設計。検出は行頭パターンのため `import()` 動的 import までは見ないが、現状の依存グラフでは問題ない

## やらないと決めたものとその理由

- `mainWorldItemSend.ts` の func 内 DOM 関数と `domUtils.ts` の重複解消: func は MAIN world にシリアライズ注入されるため外部モジュールを参照できず、分離が意図的(`src/popup/mainWorldItemSend.ts:12-15`、`src/features/dom/domUtils.ts:1-5`)。統合すると注入が壊れるためやらない
- アイテム送信の安全装置(`MAX_ITEM_SEND_COUNT=20`、`clampItemSendCount`、送信間隔 300ms、ポイント不足検知・中断)の緩和・変更: Issue の「守ること」に反するため提案しない。上限・間隔・不足検知の実装は `src/features/dom/domUtils.ts:6-10`、`src/popup/mainWorldItemSend.ts:18`・`173-199`、`src/popup/components/ItemSenderPanel.tsx:109-137` にある
- manifest 権限・host_permissions の削減: 上記の通り削減余地なしのためやらない
- 起動時満タン毎回通知(`alwaysNotifyIfNotPending`)の変更: 意図的仕様でテスト済みのためやらない
- `popupHelpers.ts` の分割、`content.ts` 起動時処理の集約、`storage.ts` 内の sync/local 責務分離など、実害が確認できない見た目の整理: 好みの違い・実害なしのため載せない・触らない
- 行数削減やファイル細分化を目的にした変更全般: Issue の「守ること」に反するためやらない

## 手元の確認

- `npm run typecheck`: 成功
- `npm test`: 成功(13 ファイル・107 テスト。Node v22.23.2 で実行。作業環境標準の Node v22.14.0 では `undici@8` のエンジン要求(`>=22.19.0`)により worker が起動しない環境起因の失敗になるため)
