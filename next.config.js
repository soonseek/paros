/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,

  /**
   * If you are using `appDir` then you must comment the below `i18n` config out.
   *
   * @see https://github.com/vercel/next.js/issues/41980
   */
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
  },

  // Increase body size limit for file uploads (Story 3.3: S3 uploads)
  api: {
    bodyParser: {
      sizeLimit: '50mb', // Allow up to 50MB files
    },
    responseLimit: false,
  },

  // Experimental features for large file handling
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  },
};

export default config;
