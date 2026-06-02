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
}

export default nextConfig
