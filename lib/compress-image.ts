// Comprime/redimensiona uma imagem NO NAVEGADOR antes do upload.
// Motivo: fotos de celular têm vários MB e estouram o limite de Server Action
// (e deixam a loja lenta). Reduzimos para no máximo `maxSize` px no maior lado
// e reexportamos em WebP (bem menor que JPEG na mesma qualidade), com fallback
// pra JPEG. Se não der pra decodificar (ex: HEIC em alguns navegadores),
// devolvemos o arquivo original — nada quebra.
export async function compressImage(file: File, maxSize = 1280, quality = 0.8): Promise<File> {
  if (typeof window === 'undefined') return file
  if (!file.type.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    const toBlob = (type: string) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

    // tenta WebP; se o navegador não suportar (blob null/type errado), cai pra JPEG
    let blob = await toBlob('image/webp')
    let ext = 'webp', mime = 'image/webp'
    if (!blob || blob.type !== 'image/webp') {
      blob = await toBlob('image/jpeg')
      ext = 'jpg'; mime = 'image/jpeg'
    }
    if (!blob || blob.size >= file.size) return file // só usa se ficou menor

    const name = file.name.replace(/\.[^.]+$/, '') + '.' + ext
    return new File([blob], name, { type: mime })
  } catch {
    return file
  }
}
