import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Still With You",
    short_name: "Still With You",
    description: "You don't have to grieve alone.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f6f1e9",
    theme_color: "#f6f1e9",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
