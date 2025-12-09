// nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: "2025-10-17",

  modules: ["@nuxtjs/tailwindcss"],

  css: ["~/assets/css/main.css"],

  runtimeConfig: {
    // Server-only (private) values
    searchAccessToken: process.env.SEARCH_ACCESS_TOKEN,
    searchEndpoint: process.env.SEARCH_ENDPOINT,

    // Public values available on client
    public: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
    },
  },

  devtools: { enabled: true },

  nitro: {
    experimental: {
      websocket: false,
    },
    // Note: no `fetch` key here—set timeout/retry per-request in $fetch options.
  },
});
