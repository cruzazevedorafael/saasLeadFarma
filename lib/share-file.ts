// Compartilha o PDF do pedido. No celular usa a "caixa de compartilhar" do
// sistema (Web Share API) — o usuário escolhe o WhatsApp e o PDF vai anexado.
// No computador (sem suporte a compartilhar arquivo), baixa o PDF e abre a
// conversa do WhatsApp com um texto curto pedindo pra anexar o arquivo baixado.
export type ShareResult = 'shared' | 'cancelled' | 'downloaded'

export async function shareOrDownloadOrder(
  file: File,
  caption: string,
  whatsappNumber: string,
): Promise<ShareResult> {
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean
    share?: (data?: ShareData) => Promise<void>
  }

  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: caption, title: 'Pedido' })
      return 'shared'
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'cancelled'
      // qualquer outra falha: cai pro plano B (download + WhatsApp)
    }
  }

  downloadFile(file)
  const phone = (whatsappNumber || '').replace(/\D/g, '')
  const texto = `${caption}\n(O PDF do pedido foi baixado no seu aparelho — anexe-o aqui na conversa.)`
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(texto)}`, '_blank')
  return 'downloaded'
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
