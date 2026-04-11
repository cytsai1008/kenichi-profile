---
title: "A simple Markdown guide"
description: "The Markdown syntax for me to quick reference."
pubDate: 2026-04-11
# heroImage: ../../../assets/blog/basic-markdown-syntax/MrGreentea62_1.jpg
tags:
  - markdown
  - guide
  - writing
featured: true
featured_priority: -999
---

Markdown is plain text with a bit of structure. If you can type in a text editor, you can write it. This guide sticks to the parts you'll actually use.

## Headings

Start a heading with `#`. More `#` signs mean a smaller heading level.

```md
# Heading 1

## Heading 2

### Heading 3
```

## Paragraphs and line breaks

Leave a blank line between paragraphs.

```md
This is the first paragraph.

This is the second paragraph.
```

If you need a hard line break, use `<br>`.

```md
First line.<br>
Second line.
```

First line.<br>
Second line.

## Emphasis

Asterisks and underscores handle most text styling.

```md
_italic_
**bold**
**_bold italic_**
~~strikethrough~~
```

Example: _italic_, **bold**, **_bold italic_**, ~~strikethrough~~

## Lists

For unordered lists, `-` is the most common choice, but `*` and `+` work too.

```md
- Item one
- Item two
- Item three
```

- Item one
- Item two
- Item three

For steps or ranked items, use numbers.

```md
1. First step
2. Second step
3. Third step
```

1. First step
2. Second step
3. Third step

## Links and images

Links use `[text](url)`.

```md
[YouTube](https://youtube.com)
```

[YouTube](https://www.youtube.com/watch?v=dQw4w9WgXcQ)

Images look the same, with a `!` in front.

```md
![A cat](./cat.jpg)
```

![Example Image](../../../assets/blog/basic-markdown-syntax/MrGreentea62_1.jpg)

## Blockquotes

Prefix the line with `>`.

```md
> Markdown is easy to read and easy to write.
```

> Markdown is easy to read and easy to write.

## Inline code and code blocks

Wrap short commands, file names, or code fragments in backticks.

```md
Use `npm run build` to build the site.
```

For longer snippets, use triple backticks.

````md
```js
console.log("Hello, Markdown!");
```
````

## Horizontal rules

A horizontal rule is just three hyphens, asterisks, or underscores.

```md
---
```

---

## Tables

Simple tables work in many Markdown parsers, though support can vary a bit.

```md
| Syntax | Meaning   |
| ------ | --------- |
| `#`    | Heading   |
| `**`   | Bold      |
| `-`    | List item |
```

| Syntax | Meaning   |
| ------ | --------- |
| `#`    | Heading   |
| `**`   | Bold      |
| `-`    | List item |

## Task lists

These are handy for notes, drafts, and checklists.

```md
- [x] Write draft
- [ ] Review content
- [ ] Publish article
```

- [x] Write draft
- [ ] Review content
- [ ] Publish article

## Escaping special characters

Add a backslash when you want the symbol itself instead of the formatting.

```md
\*not italic\*
\# not a heading
```

## Markdown and MDX

If you're writing a normal post, plain Markdown is usually enough. Use MDX when you need imports, components, or custom markup in the middle of the page.

```mdx
---
title: "MDX Example"
description: "Using a component inside content."
pubDate: 2026-04-11
---

import { SquareArrowOutUpRight } from "@lucide/astro";

This is normal Markdown text with an Astro component dropped into the middle.

<a href="https://example.com" target="_blank" rel="noopener noreferrer">
  Visit site <SquareArrowOutUpRight size={14} class="mb-0.5 inline align-middle" />
</a>
```

In short, use `.md` for plain content and `.mdx` when the content needs to behave a bit more like a component.

## Summary

That's most of Markdown in practice. Headings, lists, links, quotes, and code blocks will get you through most posts. When plain text stops being enough, switch to MDX.
