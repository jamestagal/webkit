import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import compress from "@playform/compress";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, passthroughImageService } from "astro/config";
import AutoImport from "astro-auto-import";
import icon from "astro-icon";

// https://astro.build/config
export default defineConfig({
  site: "https://webkit.au",
  output: "static",
  adapter: cloudflare({
    // Disable adapter's auto-bound IMAGES (Cloudflare Images) — we use the
    // passthrough image service below so <Image /> renders <img src=original>
    // instead of /_image?href=… (which 404s on static deploys without the
    // runtime image-transform endpoint).
    imageService: "passthrough",
  }),
  // <Image /> on output: 'static' + Cloudflare adapter would need either a
  // paid Cloudflare Images plan or the runtime /_image endpoint (only present
  // in 'server' mode). Passthrough renders originals — fine for marketing
  // content where Galaxy already ships pre-optimised assets in src/.
  image: {
    service: passthroughImageService(),
  },
  markdown: {
    shikiConfig: {
      // Shiki Themes: https://shiki.style/themes
      theme: "css-variables",
      wrap: true,
    },
  },
  integrations: [
    // example auto import component into blog post mdx files
    AutoImport({
      imports: [
        // https://github.com/delucis/astro-auto-import
        "@components/Admonition/Admonition.astro",
      ],
    }),
    mdx(),
    icon(),
    sitemap(),
    compress({
      HTML: true,
      JavaScript: false,
      CSS: false, // enabling this can cause issues
      Image: false, // astro:assets handles this. Enabling this can dramatically increase build times
      SVG: false, // astro-icon handles this
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
    // stop inlining short scripts to fix issues with ClientRouter
    build: {
      assetsInlineLimit: 0,
    },
  },
});
