/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // IMPORTANT:
  // Do NOT use `output: "export"` for this app (it breaks auth + API routes).
  // Vercel deploy should be normal Next.js server build.
};

module.exports = nextConfig;
