/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['googleapis', 'google-auth-library', 'google-ads-api', '@grpc/grpc-js'],
  },
  staticPageGenerationTimeout: 120,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.cache = false
    return config
  },
}
export default nextConfig
