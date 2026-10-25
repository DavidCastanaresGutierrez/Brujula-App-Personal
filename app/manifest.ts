import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Brújula",
    short_name: "Brújula",
    description: "Panel personal para orientar tus hábitos, constancia y progreso.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#08101f",
    theme_color: "#08101f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Mi día", short_name: "Mi día", description: "Marcar los hábitos de hoy", url: "/?view=today", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Nutrición", short_name: "Nutrición", description: "Registrar una comida", url: "/?view=nutrition", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Analizar foto", short_name: "Foto", description: "Estimar una comida desde una foto", url: "/?view=nutrition&action=photo", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
