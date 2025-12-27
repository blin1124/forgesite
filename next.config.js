/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["stripe", "@supabase/supabase-js"],
  },
}

module.exports = nextConfig
