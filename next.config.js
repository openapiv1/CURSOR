/** @type {import('next').NextConfig} */
const nextConfig = {
  // CAŁKOWICIE WYŁĄCZAM CACHE - WSZYSTKO REAL-TIME
  cacheMaxMemorySize: 0,
  generateBuildId: async () => {
    return Date.now().toString()
  },
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
          },
          {
            key: 'Pragma',
            value: 'no-cache'
          },
          {
            key: 'Expires',
            value: '0'
          },
          {
            key: 'Surrogate-Control',
            value: 'no-store'
          }
        ]
      }
    ]
  },
  // Wyłączam fetch cache
  experimental: {
    workerThreads: false,
    cpus: 1
  },
  // Wyłączam wszystkie optymalizacje które mogą cachować
  compress: false,
  poweredByHeader: false,
  reactStrictMode: false,
  // Wyłączam static generation
  output: 'standalone'
}

module.exports = nextConfig