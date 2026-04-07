import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { photosLoader } from "./loaders/photosLoader";

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: z.optional(image()),
      tags: z.array(z.string()).optional(),
      featured: z.boolean().default(false),
    }),
});

const gallery = defineCollection({
  loader: glob({ base: "./src/content/gallery", pattern: "**/*.{md,mdx}" }),
  schema: () =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      titleI18n: z
        .object({
          "zh-tw": z.string().optional(),
          "zh-cn": z.string().optional(),
        })
        .optional(),
      descriptionI18n: z
        .object({
          "zh-tw": z.string().optional(),
          "zh-cn": z.string().optional(),
        })
        .optional(),
      image: z.string(),
      date: z.coerce.date(),
      category: z.enum(["ref-sheet", "commission", "other"]).default("other"),
      artist: z.string().optional(),
      artistI18n: z
        .object({
          "zh-tw": z.string().optional(),
          "zh-cn": z.string().optional(),
        })
        .optional(),
      artistUrl: z.string().url().optional(),
      featured: z.boolean().default(false),
    }),
});

const photos = defineCollection({
  loader: photosLoader("./src/content/photos"),
  schema: z.object({
    src: z.string(),
    slug: z.string(),
    album: z.string().optional(),
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date(),
    location: z.string().optional(),
    imagePath: z.string(),
    exif: z.object({
      camera: z.string().optional(),
      lens: z.string().optional(),
      focalLength: z.string().optional(),
      aperture: z.string().optional(),
      shutter: z.string().optional(),
      iso: z.string().optional(),
      date: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      gps: z.object({ lat: z.number(), lon: z.number() }).optional(),
    }),
  }),
});

export const collections = { blog, gallery, photos };
