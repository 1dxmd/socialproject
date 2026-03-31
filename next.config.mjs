/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable static optimization for API routes that need long-running connections
  experimental: {
    serverComponentsExternalPackages: ["@anthropic-ai/sdk"],
  },
};

export default nextConfig;
