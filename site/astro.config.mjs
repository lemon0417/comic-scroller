import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://lemon0417.github.io",
  base: "/comic-scroller",
  integrations: [
    starlight({
      title: "Comic Scroller",
      description: "Official docs and install guide for the Comic Scroller browser extension.",
      customCss: ["/src/styles/custom.css"],
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/lemon0417/comic-scroller",
        },
      ],
      sidebar: [
        {
          label: "Guides",
          items: ["install", "development"],
        },
      ],
    }),
  ],
});
