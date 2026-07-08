// scripts/gen-icons.mjs — gera ícones PNG sólidos (cor da marca) para o PWA.
// Ícone padrão/fallback do app quando a farmácia não tem logo própria.
// Uso: node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUB = join(ROOT, 'public')
mkdirSync(PUB, { recursive: true })

// cor da marca #F97316 → RGB, e o "L" em branco no centro (bloco simples).
const BRAND = [0xf9, 0x73, 0x16]
const WHITE = [0xff, 0xff, 0xff]

const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

// desenha um "L" grosso branco sobre fundo laranja (marca minimalista)
function pixel(x, y, size) {
  const u = size / 16
  const inL = x >= 5 * u && x <= 7 * u && y >= 3 * u && y <= 13 * u          // haste vertical
  const inBase = x >= 5 * u && x <= 11 * u && y >= 11 * u && y <= 13 * u     // base horizontal
  return inL || inBase ? WHITE : BRAND
}

function png(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0 // 8-bit RGB
  const raw = Buffer.alloc(size * (1 + size * 3))
  let o = 0
  for (let y = 0; y < size; y++) {
    raw[o++] = 0 // filtro none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y, size)
      raw[o++] = r; raw[o++] = g; raw[o++] = b
    }
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

for (const size of [192, 512]) {
  writeFileSync(join(PUB, `icon-${size}.png`), png(size))
  console.log(`✓ public/icon-${size}.png`)
}
console.log('Ícones gerados.')
