# Vite build の entry 分離調査 (Issue #49)

## 背景

Chrome 拡張の content script (`dist/assets/content.js`) は **classic script** として読み込まれるため、ESM の `import` 文を含むと動作しない。

一方 Vite(Rollup)は、複数の entry(popup / content / background)が同じモジュールを import している場合に共有 chunk を切り出す。結果として `content.js` の先頭に `import ... from "./xxx.js"` が出力され、content script が壊れる。これは PR #43 で実際に発生し、`scripts/checkContentScriptBundle.mjs` が検出した。

この制約を回避するため、これまでは **定数や小さなユーティリティを各 entry 側にあえて複製** していた。その結果、以下のリファクタが実施できなかった。

- #47: `content.ts` / `background.ts` から `storage.ts` への集約(定数の単一ソース化)
- #48: `itemSender.ts`(content側) と `pointRecoveryNotifier.ts`(background側) のポイント正規表現の共通化

## 再現条件の特定

まず「どういう条件で壊れるのか」を切り分けた。

| 条件 | 結果 |
|---|---|
| 定数1つだけのモジュールを content + background から import | **壊れない**(tree-shaking で消えるため) |
| 同上を popup も加えた3 entry から import | **壊れない**(同上) |
| 実際に使われる関数を持つ `domUtils.ts` を popup + content から import | **壊れる**(`dist/assets/domUtils.js` が生成され `content.js` が `import{n as e,...}from"./domUtils.js"`) |

つまり **「実際に使用されるコードを複数 entry が共有したとき」** に共有 chunk が生成される。検証用のダミー定数では再現しないため、調査時は実コードで確認する必要がある。

## 各案の検証結果

### 案1: `build.rollupOptions.output.manualChunks` で共有 chunk 生成を抑止する

**不可**。`manualChunks` は「あるモジュールをどの chunk に入れるか」を指定する仕組みで、1モジュールは1 chunk にしか属せない。同じモジュールを複数 entry へ複製して inline する用途には使えない(重複排除は Rollup の設計思想そのもの)。

### 案2: content script のみ `format: "iife"` の別ビルドに分離する

**採用**。iife は単一 entry を1ファイルに自己完結させるため、共有 chunk が原理的に発生しない。popup は React のため ESM を維持する必要があるが、content だけ分離すれば両立できる。

### 案3: vite build を entry ごとに複数回実行する

案2と実質同じアプローチ。環境変数 `BUILD_TARGET` による設定切り替え + `npm run build` での2回実行として実装した(下記)。

### 案4: 既存運用を壊さないか

壊さないことを確認済み(検証結果は後述)。

## 採用した構成

`vite.config.ts` を `BUILD_TARGET` で分岐させる。

- `BUILD_TARGET` 未設定: popup + background を従来通り ESM でビルド(`emptyOutDir: true`)
- `BUILD_TARGET=content`: content のみ `format: "iife"` でビルド(`emptyOutDir: false` で1回目の出力を保持)

`package.json`:

```
"build": "tsc --noEmit && vite build && BUILD_TARGET=content vite build"
```

## 検証結果

`src/popup/App.tsx` から `src/features/dom/domUtils.ts` を import する形(= PR #43 で壊れた条件そのもの)に戻した状態で検証した。

| 検証 | 結果 |
|---|---|
| `npm run build` | 成功 |
| `dist/assets/content.js` の形式 | `(function(){...})()` の IIFE、`import` 文なし |
| `node scripts/checkContentScriptBundle.mjs` | 合格 |
| `npm run typecheck` | 成功 |
| `npm test` | 成功 |
| `npm run package:release` | 成功(zip 生成を確認) |
| `dist/` の出力ファイル構成 | 変化なし(`background.js` / `content.js` / `popup.css` / `popup.js` / `popup.html`) |
| `public/manifest.json` からの参照パス | 変更不要 |

つまり **popup と content が同じモジュールを共有してもビルドが壊れなくなった。**

なお、background と content の共有についても原理的に問題ない。content は常に独立した自己完結ビルドになるため他 entry の影響を受けず、background と popup の間で共有 chunk が生まれても、両者は ESM を読み込める(background は `type: "module"` の service worker、popup は通常のページ)。

## この変更で解禁されるもの

- #47 storage 直操作・定数複製の集約 → **着手可能**
- #48 ポイント正規表現の集約 → **着手可能**
- `src/popup/App.tsx` にある clamp 関数の複製解消 → 着手可能(#47 か #48 に含めるか、別Issueで対応)

## 残るリスク・注意点

- **`scripts/checkContentScriptBundle.mjs` は引き続き必要**。ビルド構成の退行(誰かが content を共通ビルドへ戻す等)を検出する最後の砦として残す
- content.js のサイズが微増する(11.71kB → 11.86kB)。共有 chunk による重複排除が効かなくなるため。現状の規模では無視できる
- ビルドが2パスになるため、build 時間がわずかに増える(実測で +25ms 程度)
- content 側は iife のため、将来 content script で dynamic import を使いたくなった場合は別途検討が必要(現状そのような要件はない)
