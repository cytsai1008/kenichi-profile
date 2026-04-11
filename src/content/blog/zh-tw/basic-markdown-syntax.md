---
title: "Markdown 基礎語法速查"
description: "把最常用的 Markdown 語法整理在一起，查起來比較快。"
pubDate: 2026-04-11
# heroImage: ../../../assets/blog/basic-markdown-syntax/MrGreentea62_1.jpg
tags:
  - markdown
  - guide
  - writing
featured: true
featured_priority: -999
---

Markdown 就是帶一點結構的純文字。只要會在文字編輯器裡打字，基本上就會用。這篇只整理平常最常碰到的那些語法。

## 標題

標題前面加 `#` 就可以了。`#` 越多，層級越低。

```md
# 標題 1

## 標題 2

### 標題 3
```

## 段落與換行

段落之間空一行就好。

```md
這是第一段。

這是第二段。
```

如果真的要強制換行，直接寫 `<br>`。

```md
第一行。<br>
第二行。
```

第一行。<br>
第二行。

## 強調文字

星號和底線就能處理大部分的文字樣式。

```md
_斜體_
**粗體**
**_粗斜體_**
~~刪除線~~
```

範例：_斜體_、**粗體**、**_粗斜體_**、~~刪除線~~

## 清單

無序清單最常用的是 `-`，不過 `*` 和 `+` 也可以。

```md
- 項目一
- 項目二
- 項目三
```

- 項目一
- 項目二
- 項目三

有順序的步驟或項目就用數字。

```md
1. 第一步
2. 第二步
3. 第三步
```

1. 第一步
2. 第二步
3. 第三步

## 連結與圖片

連結寫成 `[文字](網址)`。

```md
[YouTube](https://youtube.com)
```

[YouTube](https://www.youtube.com/watch?v=dQw4w9WgXcQ)

圖片和連結很像，只是前面多一個 `!`。

```md
![一隻貓](./cat.jpg)
```

![Example Image](../../../assets/blog/basic-markdown-syntax/MrGreentea62_1.jpg)

## 引用

前面加 `>` 就行。

```md
> Markdown 容易閱讀，也容易撰寫。
```

> Markdown 容易閱讀，也容易撰寫。

## 行內程式碼與程式碼區塊

短的指令、檔名或程式碼片段可以用反引號包起來。

```md
使用 `npm run build` 來建置網站。
```

比較長的程式碼就用三個反引號。

````md
```js
console.log("Hello, Markdown!");
```
````

## 分隔線

分隔線其實很單純，連打三個連字號、星號或底線就可以。

```md
---
```

---

## 表格

簡單表格大多數 Markdown 解析器都支援，不過細節還是可能有差。

```md
| 語法 | 用途     |
| ---- | -------- |
| `#`  | 標題     |
| `**` | 粗體     |
| `-`  | 清單項目 |
```

| 語法 | 用途     |
| ---- | -------- |
| `#`  | 標題     |
| `**` | 粗體     |
| `-`  | 清單項目 |

## 待辦清單

拿來記待辦、草稿進度都很好用。

```md
- [x] 寫初稿
- [ ] 校對內容
- [ ] 發布文章
```

- [x] 寫初稿
- [ ] 校對內容
- [ ] 發布文章

## 跳脫特殊字元

如果你只是想顯示 Markdown 符號本身，不想讓它生效，就在前面加反斜線。

```md
\*不是斜體\*
\# 不是標題
```

## Markdown 與 MDX

如果只是寫一般文章，Markdown 通常就夠了。要是你想在內容裡匯入元件、插入 Astro 元件，或直接混用 HTML 標記，再換成 MDX 就好。

```mdx
---
title: "MDX 範例"
description: "在內容裡使用元件。"
pubDate: 2026-04-11
---

import { SquareArrowOutUpRight } from "@lucide/astro";

這是一段一般的 Markdown 文字，中間直接插入 Astro 元件也沒問題。

<a href="https://example.com" target="_blank" rel="noopener noreferrer">
  前往網站 <SquareArrowOutUpRight size={14} class="mb-0.5 inline align-middle" />
</a>
```

簡單講，純文章用 `.md`，內容需要元件時用 `.mdx`。

## 總結

實際上常用的就這些。標題、清單、連結、引用和程式碼區塊，已經能處理大部分文章。等到純文字不夠用了，再換 MDX。
