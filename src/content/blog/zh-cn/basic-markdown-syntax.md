---
title: "Markdown 基础语法速查"
description: "把最常用的 Markdown 语法整理在一起，查起来比较快。"
pubDate: 2026-04-11
# heroImage: ../../../assets/blog/basic-markdown-syntax/MrGreentea62_1.jpg
tags:
  - markdown
  - guide
  - writing
featured: true
featured_priority: -999
---

Markdown 就是带一点结构的纯文字。只要会在文字编辑器里打字，基本上就会用。这篇只整理平常最常碰到的那些语法。

## 标题

标题前面加 `#` 就可以了。`#` 越多，层级越低。

```md
# 标题 1

## 标题 2

### 标题 3
```

## 段落与换行

段落之间空一行就行。

```md
这是第一段。

这是第二段。
```

如果真的要强制换行，或者直接写 `<br>`。

```md
第一行。<br>
第二行。
```

第一行。<br>
第二行。

## 强调文字

星号和底线就能处理大部分文字样式。

```md
_斜体_
**粗体**
**_粗斜体_**
~~删除线~~
```

示例：_斜体_、**粗体**、**_粗斜体_**、~~删除线~~

## 列表

无序列表最常用的是 `-`，不过 `*` 和 `+` 也可以。

```md
- 项目一
- 项目二
- 项目三
```

- 项目一
- 项目二
- 项目三

有顺序的步骤或项目就用数字。

```md
1. 第一步
2. 第二步
3. 第三步
```

1. 第一步
2. 第二步
3. 第三步

## 链接与图片

链接写成 `[文字](网址)`。

```md
[YouTube](https://youtube.com)
```

[YouTube](https://www.youtube.com/watch?v=dQw4w9WgXcQ)

图片和链接很像，只是前面多一个 `!`。

```md
![一只猫](./cat.jpg)
```

![Example Image](../../../assets/blog/basic-markdown-syntax/MrGreentea62_1.jpg)

## 引用

前面加 `>` 就行。

```md
> Markdown 容易阅读，也容易编写。
```

> Markdown 容易阅读，也容易编写。

## 行内代码与代码块

短的命令、文件名或代码片段可以用反引号包起来。

```md
使用 `npm run build` 来构建网站。
```

比较长的代码就用三个反引号。

````md
```js
console.log("Hello, Markdown!");
```
````

## 分隔线

分隔线其实很简单，连打三个连字符、星号或底线就可以。

```md
---
```

---

## 表格

简单表格大多数 Markdown 解析器都支持，不过细节上还是可能有差别。

```md
| 语法 | 用途   |
| ---- | ------ |
| `#`  | 标题   |
| `**` | 粗体   |
| `-`  | 列表项 |
```

| 语法 | 用途   |
| ---- | ------ |
| `#`  | 标题   |
| `**` | 粗体   |
| `-`  | 列表项 |

## 待办列表

拿来记待办、草稿进度都很好用。

```md
- [x] 写初稿
- [ ] 校对内容
- [ ] 发布文章
```

- [x] 写初稿
- [ ] 校对内容
- [ ] 发布文章

## 转义特殊字符

如果你只是想显示 Markdown 符号本身，不想让它生效，就在前面加反斜线。

```md
\*不是斜体\*
\# 不是标题
```

## Markdown 与 MDX

如果只是写普通文章，Markdown 通常就够了。要是你想在内容里导入组件、插入 Astro 组件，或者直接混用 HTML 标记，再换成 MDX 就好。

```mdx
---
title: "MDX 示例"
description: "在内容里使用组件。"
pubDate: 2026-04-11
---

import { SquareArrowOutUpRight } from "@lucide/astro";

这是一段普通的 Markdown 文字，中间直接插入 Astro 组件也没问题。

<a href="https://example.com" target="_blank" rel="noopener noreferrer">
  前往网站 <SquareArrowOutUpRight size={14} class="mb-0.5 inline align-middle" />
</a>
```

简单说，纯文章用 `.md`，内容需要组件时用 `.mdx`。

## 总结

实际常用的就这些。标题、列表、链接、引用和代码块，已经够写大部分文章了。等到纯文字不够用，再换 MDX。
