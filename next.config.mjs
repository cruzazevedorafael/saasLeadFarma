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
    return [
      {
        // Páginas HTML sempre revalidam: assim, depois de cada deploy, os
        // clientes pegam a versão nova logo (sem ficar presos em cache antigo,
        // que era o que mostrava "convidar para o WhatsApp" da versão velha).
        // Os arquivos com hash em /_next/static ficam de fora e seguem
        // cacheáveis pra sempre (não mudam sem mudar o nome).
        source: '/((?!_next/static|_next/image).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
        ],
      },
    ]
  },
}

export default nextConfig
