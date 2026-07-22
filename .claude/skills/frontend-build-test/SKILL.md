---
name: frontend-build-test
description: |
  TwitCasting Toolkit の React/TypeScript popup と Chrome 拡張機能ビルドを検証する。
  Use when: 型チェック、ビルド、拡張機能の検証を依頼された時。
---

# フロントエンド ビルド・テスト

## 作業ディレクトリ

リポジトリルート。

## コマンド

### 依存関係インストール

```bash
npm install
```

### 型チェック

```bash
npm run typecheck
```

### Chrome 拡張ビルド

```bash
npm run build
```

### 開発サーバー起動

```bash
npm run dev
```

## 推奨実行順序

1. `npm run typecheck`
2. `npm run build`

## 確認観点

- `dist/manifest.json` が出力される
- manifest の `content_scripts[].js` が `dist/assets/content.js` と一致する
- content script が単体 JS として出力され、runtime import を持たない
- popup が `dist/popup.html` として出力される
- host permission が TwitCasting に限定されている
