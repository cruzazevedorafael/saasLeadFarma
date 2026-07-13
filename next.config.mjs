/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    // Fotos de produto/banner sobem por Server Action. O padrão do Next é 1MB,
    // o que faz fotos de celular falharem. Aumentamos a folga (a imagem ainda é
    // comprimida no navegador antes de subir — ver lib/compress-image.ts).
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },
  async headers() {
    // no-cache SÓ nas áreas privadas (dados sensíveis, sempre frescos). O catálogo
    // público /f/[slug] fica de fora → pode ser cacheado por CDN + ISR (revalidate
    // na própria página), o que deixa o catálogo (o que o cliente mais acessa) rápido.
    return [
      {
        source: '/painel/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
      {
        source: '/gestao/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
    ]
  },
}

export default nextConfig
