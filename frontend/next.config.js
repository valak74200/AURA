/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['images.pexels.com'],
  },
  // Disable SWC completely to avoid binary loading issues
  swcMinify: false,
  experimental: {
    forceSwcTransforms: false,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Use Babel instead of SWC
  transpilePackages: [],
}

module.exports = nextConfig