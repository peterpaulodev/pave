import { createSerwistRoute } from "@serwist/turbopack";

// Serves the service worker (compiled from app/sw.ts) at a fixed top-level
// URL (/sw.js) without needing a static file in public/ — @serwist/next's
// usual webpack-based approach (static-file injection) doesn't support
// Turbopack, which this project builds with.
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "app/sw.ts",
  });
