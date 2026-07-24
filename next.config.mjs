import withPWA from "next-pwa";

/** @type {import('next').NextConfig} */
const baseConfig = {
  reactStrictMode: true,
  experimental: {
    // Sin caché de cliente para páginas dinámicas: al navegar (ej. entrar a la
    // bandeja) siempre se pide fresco al servidor, como un F5. Evita que se vea
    // una versión vieja/en 0 de los controles hasta recargar a mano.
    staleTimes: { dynamic: 0, static: 180 },
  },
};

const withPWAConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  cleanupOutdatedCaches: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      // Las navegaciones (HTML) siempre intentan la red primero;
      // así un deploy nuevo no queda atrapado en una versión vieja.
      urlPattern: ({ request }) => request.mode === "navigate",
      handler: "NetworkFirst",
      options: {
        cacheName: "pages-cache",
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
      },
    },
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "supabase-cache",
        networkTimeoutSeconds: 5,
        // Caché de respaldo solo para cortes de red: expira a los 60s para no
        // servir datos viejos (antes eran 24h). El offline del cadete usa
        // IndexedDB aparte, así que esto no lo afecta.
        expiration: { maxEntries: 200, maxAgeSeconds: 60 },
      },
    },
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "static-cache",
        expiration: { maxEntries: 200, maxAgeSeconds: 604800 },
      },
    },
    {
      urlPattern: /\/_next\/image\?.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "image-cache",
        expiration: { maxEntries: 100, maxAgeSeconds: 604800 },
      },
    },
  ],
});

export default withPWAConfig(baseConfig);
