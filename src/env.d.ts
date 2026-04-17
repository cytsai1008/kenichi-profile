/// <reference types="astro/client" />

declare module "virtual:gallery-manifest" {
  import type { BuildManifest } from "./lib/galleryAssetShared.js";
  const manifest: BuildManifest;
  export default manifest;
}
