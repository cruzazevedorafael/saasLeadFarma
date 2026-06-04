// components/cart.tsx
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCartStore, type CartItem } from '@/lib/store'
import { cartPriceType, cartTotal, unitPriceFor, piecesUntilWholesale, type PriceType } from '@/lib/data/cart.helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShoppingCart, X, Trash2, Plus, Minus, Send, User, Phone, Tag } from 'lucide-react'
import { criarPedido } from '@/app/_actions/criar-pedido'
import type { ShippingMethod } from '@/lib/data/shipping'
import type { PaymentMethod } from '@/lib/data/payment'

const formatPrice = (price: number) => `R$ ${price.toFixed(2).replace('.', ',')}`

export function Cart({ threshold, whatsappNumber, shippingMethods, paymentMethods }: { threshold: number; whatsappNumber: string; shippingMethods: ShippingMethod[]; paymentMethods: PaymentMethod[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [shippingId, setShippingId] = useState<string>('')
  const [paymentId, setPaymentId] = useState<string>('')

  const { items, removeItem, updateQuantity, clearCart, getTotalItems } = useCartStore()

  const priceType: PriceType = cartPriceType(items, threshold)
  const total = cartTotal(items, priceType)
  const round2 = (n: number) => Math.round(n * 100) / 100
  const selShipping = shippingMethods.find((m) => m.id === shippingId)
  const selPayment = paymentMethods.find((m) => m.id === paymentId)
  const subtotal = total
  const frete = selShipping?.price ?? 0
  const acrescimo = selPayment ? round2((subtotal + frete) * (selPayment.surchargePercent / 100) + selPayment.surchargeFixed) : 0
  const totalFinal = round2(subtotal + frete + acrescimo)
  const pesoTotalG = items.reduce((acc, i) => acc + i.product.weightGrams * i.quantity, 0)
  const faltam = piecesUntilWholesale(items, threshold)
  const totalItems = getTotalItems()

  const generateOrderText = () => {
    const date = new Date().toLocaleDateString('pt-BR')
    const fmtKg = (g: number) => `${(g / 1000).toFixed(3).replace('.', ',')} kg`
    let text = `Data: ${date}\n\n`
    text += `*Cliente:* ${customerName}\n`
    text += `*Telefone:* ${customerPhone}\n\n`
    text += `*Tipo de preço:* ${priceType === 'wholesale' ? 'ATACADO' : 'VAREJO'}\n\n`
    text += `*ITENS DO PEDIDO:*\n`
    text += `━━━━━━━━━━━━━━━━━━\n\n`
    items.forEach((item, index) => {
      const price = unitPriceFor(item.product, priceType)
      text += `${index + 1}. *${item.product.name}* (${item.product.code})\n`
      text += `   Tamanho: ${item.size}\n`
      text += `   Cor: ${item.color}\n`
      text += `   Qtd: ${item.quantity} x ${formatPrice(price)}\n`
      text += `   Subtotal: *${formatPrice(price * item.quantity)}*\n\n`
    })
    text += `━━━━━━━━━━━━━━━━━━\n`
    text += `*Subtotal:* ${formatPrice(subtotal)}\n`
    text += `*Peso total:* ${fmtKg(pesoTotalG)}\n`
    text += `*Envio:* ${selShipping ? `${selShipping.name} (${formatPrice(frete)})` : 'A combinar'}\n`
    text += `*Pagamento:* ${selPayment ? selPayment.name : 'A combinar'}${acrescimo > 0 ? ` (+${formatPrice(acrescimo)})` : ''}\n`
    text += `*TOTAL GERAL: ${formatPrice(totalFinal)}*\n`
    text += `━━━━━━━━━━━━━━━━━━\n\n`
    text += `_Pedido enviado pelo Menu Digital KAROLLA FIT_`
    return text
  }

  const handleSendOrder = async () => {
    if (!customerName.trim() || !customerPhone.trim()) return
    setIsLoading(true)
    setAviso(null)

    let numeroPedido: number | null = null
    try {
      const r = await criarPedido({
        customerName,
        customerPhone,
        items: items.map((i) => ({ productId: i.product.id, size: i.size, color: i.color, quantity: i.quantity })),
        shippingMethodId: shippingId || null,
        paymentMethodId: paymentId || null,
      })
      numeroPedido = r.number
    } catch {
      setAviso('Pedido enviado pelo WhatsApp, mas não foi registrado no painel. Confira lá depois.')
    }

    const header = numeroPedido ? `*PEDIDO #${numeroPedido} — KAROLLA FIT*` : '*PEDIDO KAROLLA FIT*'
    const orderText = header + '\n' + generateOrderText()
    const phone = (whatsappNumber || '').replace(/\D/g, '')
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(orderText)}`, '_blank')

    setTimeout(() => {
      setIsLoading(false)
      clearCart()
      setShowCheckout(false)
      setIsOpen(false)
      setCustomerName('')
      setCustomerPhone('')
      setShippingId('')
      setPaymentId('')
    }, 1000)
  }

  return (
    <>
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 flex items-center gap-1.5 md:gap-2 rounded-full bg-[#CFFF04] px-4 py-3 md:px-6 md:py-4 text-black font-semibold shadow-lg shadow-[#CFFF04]/20"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <ShoppingCart className="h-4 w-4 md:h-5 md:w-5" />
        <span className="text-sm md:text-base">Carrinho</span>
        {totalItems > 0 && (
          <motion.span key={totalItems} initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-black text-[#CFFF04] text-xs md:text-sm">
            {totalItems}
          </motion.span>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsOpen(false)} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 z-50 h-full w-full sm:max-w-md overflow-hidden bg-background border-l border-border shadow-2xl"
            >
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-border p-3 md:p-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-[#CFFF04]/10">
                      <ShoppingCart className="h-4 w-4 md:h-5 md:w-5 text-[#CFFF04]" />
                    </div>
                    <div>
                      <h2 className="text-base md:text-lg font-semibold">Seu Carrinho</h2>
                      <p className="text-xs md:text-sm text-muted-foreground">{totalItems} {totalItems === 1 ? 'item' : 'itens'}</p>
                    </div>
                  </div>
                  <button onClick={() => setIsOpen(false)} className="rounded-full p-2 hover:bg-muted transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {items.length > 0 && (
                  <div className={`flex items-center gap-2 px-3 md:px-4 py-2 text-xs md:text-sm border-b border-border ${priceType === 'wholesale' ? 'bg-[#CFFF04]/15 text-[#CFFF04]' : 'bg-muted/40 text-muted-foreground'}`}>
                    <Tag className="h-4 w-4" />
                    {priceType === 'wholesale'
                      ? '✓ Preço de atacado aplicado'
                      : `Faltam ${faltam} ${faltam === 1 ? 'peça' : 'peças'} que contam pro atacado`}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-3 md:p-4">
                  <AnimatePresence mode="popLayout">
                    {!showCheckout ? (
                      <motion.div key="cart-items" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -20 }} className="space-y-3 md:space-y-4">
                        {items.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 md:py-12 text-center">
                            <div className="mb-4 rounded-full bg-muted p-4 md:p-6">
                              <ShoppingCart className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground" />
                            </div>
                            <h3 className="font-semibold text-sm md:text-base">Carrinho vazio</h3>
                            <p className="text-xs md:text-sm text-muted-foreground mt-1">Adicione produtos para comecar</p>
                          </div>
                        ) : (
                          items.map((item, index) => (
                            <CartItemCard
                              key={`${item.product.id}-${item.size}-${item.color}`}
                              item={item}
                              index={index}
                              priceType={priceType}
                              onRemove={() => removeItem(item.product.id, item.size, item.color)}
                              onUpdateQuantity={(qty) => updateQuantity(item.product.id, item.size, item.color, qty)}
                            />
                          ))
                        )}
                      </motion.div>
                    ) : (
                      <motion.div key="checkout" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4 md:space-y-6">
                        <div className="text-center">
                          <h3 className="text-lg md:text-xl font-semibold mb-1 md:mb-2">Finalizar Pedido</h3>
                          <p className="text-xs md:text-sm text-muted-foreground">Preencha seus dados para enviar o pedido via WhatsApp</p>
                        </div>

                        <div className="space-y-3 md:space-y-4">
                          <div className="space-y-1.5 md:space-y-2">
                            <Label htmlFor="name" className="text-xs md:text-sm">Seu Nome</Label>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input id="name" placeholder="Digite seu nome" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="pl-10 h-10 md:h-12 bg-muted border-border text-sm md:text-base" />
                            </div>
                          </div>
                          <div className="space-y-1.5 md:space-y-2">
                            <Label htmlFor="phone" className="text-xs md:text-sm">Seu Telefone</Label>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input id="phone" placeholder="(00) 00000-0000" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="pl-10 h-10 md:h-12 bg-muted border-border text-sm md:text-base" />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 md:space-y-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs md:text-sm">Forma de envio</Label>
                            <select
                              value={shippingId}
                              onChange={(e) => setShippingId(e.target.value)}
                              className="w-full h-10 md:h-12 rounded-md border border-border bg-muted px-3 text-sm md:text-base"
                            >
                              <option value="">A combinar</option>
                              {shippingMethods.map((m) => (
                                <option key={m.id} value={m.id}>{m.name} — {formatPrice(m.price)}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs md:text-sm">Forma de pagamento</Label>
                            <select
                              value={paymentId}
                              onChange={(e) => setPaymentId(e.target.value)}
                              className="w-full h-10 md:h-12 rounded-md border border-border bg-muted px-3 text-sm md:text-base"
                            >
                              <option value="">A combinar</option>
                              {paymentMethods.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}{(m.surchargePercent > 0 || m.surchargeFixed > 0) ? ' (+acréscimo)' : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="rounded-xl bg-muted/50 p-3 md:p-4 space-y-2 md:space-y-3">
                          <h4 className="font-semibold text-xs md:text-sm">Resumo do Pedido ({priceType === 'wholesale' ? 'Atacado' : 'Varejo'})</h4>
                          {items.map((item) => {
                            const price = unitPriceFor(item.product, priceType)
                            return (
                              <div key={`${item.product.id}-${item.size}-${item.color}`} className="flex justify-between text-xs md:text-sm">
                                <span className="text-muted-foreground">{item.quantity}x {item.product.name} ({item.size})</span>
                                <span>{formatPrice(price * item.quantity)}</span>
                              </div>
                            )
                          })}
                          <div className="border-t border-border pt-2 md:pt-3 space-y-1 text-xs md:text-sm">
                            <div className="flex justify-between text-muted-foreground">
                              <span>Subtotal</span><span>{formatPrice(subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                              <span>Frete</span><span>{selShipping ? formatPrice(frete) : 'A combinar'}</span>
                            </div>
                            {acrescimo > 0 && (
                              <div className="flex justify-between text-muted-foreground">
                                <span>Acréscimo</span><span>{formatPrice(acrescimo)}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-semibold text-sm md:text-base pt-1">
                              <span>Total</span><span className="text-[#CFFF04]">{formatPrice(totalFinal)}</span>
                            </div>
                          </div>
                        </div>

                        <button onClick={() => setShowCheckout(false)} className="text-xs md:text-sm text-muted-foreground hover:text-foreground underline">Voltar ao carrinho</button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {items.length > 0 && (
                  <div className="border-t border-border p-3 md:p-4 space-y-3 md:space-y-4 bg-card">
                    {showCheckout ? (
                      <>
                        {aviso && <p className="text-xs text-amber-500">{aviso}</p>}
                        <Button onClick={handleSendOrder} disabled={!customerName.trim() || !customerPhone.trim() || isLoading} className="w-full h-12 md:h-14 bg-[#25D366] hover:bg-[#128C7E] text-white text-base md:text-lg font-semibold">
                          {isLoading ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full" />
                          ) : (
                            <><Send className="h-4 w-4 md:h-5 md:w-5 mr-2" /> Enviar pelo WhatsApp</>
                          )}
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm md:text-base text-muted-foreground">Total</span>
                          <span className="text-xl md:text-2xl font-bold text-[#CFFF04]">{formatPrice(total)}</span>
                        </div>
                        <Button onClick={() => setShowCheckout(true)} className="w-full h-12 md:h-14 bg-[#CFFF04] hover:bg-[#b8e600] text-black text-base md:text-lg font-semibold">Continuar</Button>
                        <button onClick={clearCart} className="w-full text-xs md:text-sm text-muted-foreground hover:text-destructive transition-colors">Limpar carrinho</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

function CartItemCard({ item, index, priceType, onRemove, onUpdateQuantity }: {
  item: CartItem
  index: number
  priceType: PriceType
  onRemove: () => void
  onUpdateQuantity: (qty: number) => void
}) {
  const price = unitPriceFor(item.product, priceType)
  const max = item.maxStock ?? Infinity

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -100 }} transition={{ delay: index * 0.05 }} className="flex gap-3 rounded-xl bg-muted/30 p-3 border border-border/50">
      <div className="relative h-20 w-20 overflow-hidden rounded-lg bg-muted flex-shrink-0">
        <img src={item.product.imageUrl ?? '/placeholder.svg'} alt={item.product.name} className="h-full w-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm truncate">{item.product.name}</h4>
        <div className="flex gap-2 mt-1 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">{item.size}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">{item.color}</span>
          {!item.product.countsForWholesale && (
            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-400">não conta</span>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2 bg-background rounded-lg p-0.5">
            <button onClick={() => onUpdateQuantity(Math.max(1, item.quantity - 1))} className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted transition-colors">
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
            <button
              onClick={() => onUpdateQuantity(Math.min(max, item.quantity + 1))}
              disabled={item.quantity >= max}
              className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <span className="font-semibold text-[#CFFF04]">{formatPrice(price * item.quantity)}</span>
        </div>
      </div>
      <button onClick={onRemove} className="self-start p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
        <Trash2 className="h-4 w-4" />
      </button>
    </motion.div>
  )
}
