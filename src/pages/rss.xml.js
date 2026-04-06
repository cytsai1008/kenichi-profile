import { getCollection } from "astro:content";
import rss from "@astrojs/rss";
import { SITE_DESCRIPTION, SITE_TITLE } from "../consts";
import { getBlogPostsForLocale, getBlogSlug } from "../lib/blog";

export async function GET(context) {
  const posts = getBlogPostsForLocale(await getCollection("blog"), "en");
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    items: posts.map((post) => ({
      ...post.data,
      link: `/blog/${getBlogSlug(post.id)}/`,
    })),
  });
}
