// lib/catalog-fonts.ts — resolve a fonte do catálogo escolhida pela farmácia.
// next/font auto-hospeda; preload:false → o navegador só baixa a fonte quando ela
// é de fato aplicada (só uma por catálogo), sem penalizar as demais.
import { Poppins, Sora, Merriweather, Nunito, Oswald } from 'next/font/google'

const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'], preload: false })
const sora = Sora({ subsets: ['latin'], weight: ['400', '600', '700'], preload: false })
const merriweather = Merriweather({ subsets: ['latin'], weight: ['400', '700'], preload: false })
const nunito = Nunito({ subsets: ['latin'], weight: ['400', '600', '700', '800'], preload: false })
const oswald = Oswald({ subsets: ['latin'], weight: ['400', '500', '600', '700'], preload: false })

const FAMILY: Record<string, string> = {
  poppins: poppins.style.fontFamily,
  sora: sora.style.fontFamily,
  merriweather: merriweather.style.fontFamily,
  nunito: nunito.style.fontFamily,
  oswald: oswald.style.fontFamily,
}

/** font-family da fonte escolhida; null = padrão (herda a fonte global). */
export function catalogFontFamily(key?: string | null): string | null {
  if (!key || key === 'padrao') return null
  return FAMILY[key] ?? null
}
