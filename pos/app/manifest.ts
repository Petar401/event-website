import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tilda POS",
    short_name: "Tilda",
    description: "The point of sale your AI can run.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0d0d0f",
    theme_color: "#ff5a1f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
