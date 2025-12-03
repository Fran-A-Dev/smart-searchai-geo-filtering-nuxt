// nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: "2025-10-17",
  modules: ["@nuxtjs/tailwindcss"],
  css: [
    "~/assets/css/main.css", // your Tailwind entry
  ],
  runtimeConfig: {
    // server-only secrets
    searchAccessToken: process.env.SEARCH_ACCESS_TOKEN,
    searchEndpoint: process.env.NUXT_PUBLIC_SEARCH_ENDPOINT,
    public: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
    },
  },
  devtools: { enabled: true },
  nitro: {
    experimental: {
      websocket: false,
    },
  },
});
