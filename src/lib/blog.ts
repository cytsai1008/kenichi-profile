import type { CollectionEntry } from "astro:content";
import type { Locale } from "../i18n/utils";

export function getBlogSlug(id: string): string {
  return id.replace(/^(en|zh-tw|zh-cn)\//, "");
}

export function getBlogPostsForLocale(
  posts: CollectionEntry<"blog">[],
  locale: Locale
): CollectionEntry<"blog">[] {
  return posts.filter(
    (post) => post.id.startsWith(`${locale}/`) && (import.meta.env.DEV || !post.data.draft)
  );
}

export function compareBlogPostsByDate(
  a: CollectionEntry<"blog">,
  b: CollectionEntry<"blog">
): number {
  return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
}

export function compareFeaturedBlogPosts(
  a: CollectionEntry<"blog">,
  b: CollectionEntry<"blog">
): number {
  return b.data.featured_priority - a.data.featured_priority || compareBlogPostsByDate(a, b);
}
