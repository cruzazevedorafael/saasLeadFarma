// lib/catalog-fonts.options.ts — opções de fonte do catálogo (sem next/font → usável no client).
export interface CatalogFontOption { key: string; label: string }

export const CATALOG_FONT_OPTIONS: CatalogFontOption[] = [
  { key: 'padrao', label: 'Padrão (limpa)' },
  { key: 'poppins', label: 'Poppins — moderna' },
  { key: 'sora', label: 'Sora — tech' },
  { key: 'merriweather', label: 'Merriweather — clássica (serifada)' },
  { key: 'nunito', label: 'Nunito — amigável (arredondada)' },
  { key: 'oswald', label: 'Oswald — impacto (condensada)' },
]

export const CATALOG_FONT_KEYS = CATALOG_FONT_OPTIONS.map((o) => o.key)
