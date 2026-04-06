import type { CollectionEntry } from "astro:content";
import type { Locale } from "../i18n/utils";

export function getBlogSlug(id: string): string {
  return id.replace(/^(en|zh-tw|zh-cn)\//, "");
}

export function getBlogPostsForLocale(
  posts: CollectionEntry<"blog">[],
  locale: Locale
): CollectionEntry<"blog">[] {
  return posts.filter((post) => post.id.startsWith(`${locale}/`));
}
