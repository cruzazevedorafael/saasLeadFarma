'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Phone, MapPin, IdCard, ShieldCheck } from 'lucide-react'
import { formatCpf, isValidCpf, onlyDigits } from '@/lib/cpf'
import { buscarClientePorCpf } from '@/app/_actions/buscar-cliente'

export interface ClienteData {
  name: string
  phone: string
  cpf: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  lgpdConsent: boolean
}

export const clienteVazio: ClienteData = {
  name: '', phone: '', cpf: '', cep: '', logradouro: '', numero: '',
  complemento: '', bairro: '', cidade: '', uf: '', lgpdConsent: false,
}

// Obrigatórios: nome, celular, CPF válido, endereço (cep/logradouro/bairro/cidade/uf)
// e consentimento LGPD. Opcionais: número e complemento.
export function clienteValido(c: ClienteData): boolean {
  return (
    c.name.trim().length > 0 &&
    c.phone.trim().length > 0 &&
    isValidCpf(c.cpf) &&
    c.cep.trim().length > 0 &&
    c.logradouro.trim().length > 0 &&
    c.bairro.trim().length > 0 &&
    c.cidade.trim().length > 0 &&
    c.uf.trim().length > 0 &&
    c.lgpdConsent
  )
}

const fmtCep = (v: string) => {
  const d = onlyDigits(v).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

export function CheckoutCliente({
  pharmacyId, value, onChange,
}: {
  pharmacyId: string
  value: ClienteData
  onChange: (c: ClienteData) => void
}) {
  const [cpfBuscado, setCpfBuscado] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [avisoCep, setAvisoCep] = useState<string | null>(null)
  const set = (patch: Partial<ClienteData>) => onChange({ ...value, ...patch })

  // Autofill por CPF: quando o CPF fica válido, procura cadastro na farmácia.
  const onCpfBlur = async () => {
    const d = onlyDigits(value.cpf)
    if (!isValidCpf(d) || d === cpfBuscado) return
    setCpfBuscado(d)
    setBuscando(true)
    try {
      const cli = await buscarClientePorCpf(pharmacyId, d)
      if (cli && typeof window !== 'undefined' &&
          window.confirm('Encontramos um cadastro com este CPF. Preencher seus dados automaticamente?')) {
        onChange({
          ...value,
          name: cli.name || value.name,
          phone: cli.phone || value.phone,
          cep: cli.cep, logradouro: cli.logradouro, numero: cli.numero,
          complemento: cli.complemento, bairro: cli.bairro, cidade: cli.cidade, uf: cli.uf,
          lgpdConsent: cli.lgpdConsent || value.lgpdConsent,
        })
      }
    } finally {
      setBuscando(false)
    }
  }

  // Autofill de endereço pelo CEP (ViaCEP).
  const onCepBlur = async () => {
    const d = onlyDigits(value.cep)
    if (d.length !== 8) return
    setAvisoCep(null)
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`)
      const j = await r.json()
      if (j.erro) { setAvisoCep('CEP não encontrado.'); return }
      set({
        logradouro: j.logradouro || value.logradouro,
        bairro: j.bairro || value.bairro,
        cidade: j.localidade || value.cidade,
        uf: j.uf || value.uf,
      })
    } catch {
      setAvisoCep('Não deu pra buscar o CEP — preencha à mão.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="c-name" className="text-xs md:text-sm">Nome completo</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input id="c-name" autoComplete="name" placeholder="Seu nome" value={value.name}
              onChange={(e) => set({ name: e.target.value })} className="pl-10 h-10 md:h-12 bg-muted border-border" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="c-cpf" className="text-xs md:text-sm">CPF</Label>
            <div className="relative">
              <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="c-cpf" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00"
                value={formatCpf(value.cpf)} onChange={(e) => set({ cpf: onlyDigits(e.target.value) })}
                onBlur={onCpfBlur} className="pl-10 h-10 md:h-12 bg-muted border-border" />
            </div>
            {value.cpf.length > 0 && !isValidCpf(value.cpf) && (
              <p className="text-[11px] text-amber-500">CPF incompleto ou inválido.</p>
            )}
            {buscando && <p className="text-[11px] text-muted-foreground">Buscando cadastro...</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-phone" className="text-xs md:text-sm">Celular</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="c-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000"
                value={value.phone} onChange={(e) => set({ phone: e.target.value })} className="pl-10 h-10 md:h-12 bg-muted border-border" />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs md:text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" /> Endereço de entrega
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="c-cep" className="text-xs">CEP</Label>
            <Input id="c-cep" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000"
              value={fmtCep(value.cep)} onChange={(e) => set({ cep: onlyDigits(e.target.value) })}
              onBlur={onCepBlur} className="h-10 md:h-12 bg-muted border-border" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="c-log" className="text-xs">Rua / Logradouro</Label>
            <Input id="c-log" autoComplete="address-line1" placeholder="Rua, avenida..." value={value.logradouro}
              onChange={(e) => set({ logradouro: e.target.value })} className="h-10 md:h-12 bg-muted border-border" />
          </div>
        </div>
        {avisoCep && <p className="text-[11px] text-amber-500">{avisoCep}</p>}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="c-num" className="text-xs">Número <span className="text-muted-foreground">(opc.)</span></Label>
            <Input id="c-num" placeholder="123" value={value.numero}
              onChange={(e) => set({ numero: e.target.value })} className="h-10 md:h-12 bg-muted border-border" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="c-comp" className="text-xs">Complemento <span className="text-muted-foreground">(opc.)</span></Label>
            <Input id="c-comp" placeholder="Apto, bloco..." value={value.complemento}
              onChange={(e) => set({ complemento: e.target.value })} className="h-10 md:h-12 bg-muted border-border" />
          </div>
        </div>
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-3 space-y-1.5">
            <Label htmlFor="c-bairro" className="text-xs">Bairro</Label>
            <Input id="c-bairro" placeholder="Bairro" value={value.bairro}
              onChange={(e) => set({ bairro: e.target.value })} className="h-10 md:h-12 bg-muted border-border" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="c-cidade" className="text-xs">Cidade</Label>
            <Input id="c-cidade" placeholder="Cidade" value={value.cidade}
              onChange={(e) => set({ cidade: e.target.value })} className="h-10 md:h-12 bg-muted border-border" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-uf" className="text-xs">UF</Label>
            <Input id="c-uf" maxLength={2} placeholder="UF" value={value.uf}
              onChange={(e) => set({ uf: e.target.value.toUpperCase().slice(0, 2) })} className="h-10 md:h-12 bg-muted border-border uppercase" />
          </div>
        </div>
      </div>

      <label className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 cursor-pointer">
        <input type="checkbox" checked={value.lgpdConsent}
          onChange={(e) => set({ lgpdConsent: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-[#F97316]" />
        <span className="text-[11px] md:text-xs text-muted-foreground leading-snug">
          <ShieldCheck className="inline h-3.5 w-3.5 text-[#F97316] mr-1 align-text-bottom" />
          Autorizo o uso dos meus dados (nome, CPF, contato e endereço) para processar este pedido e
          agilizar compras futuras nesta farmácia, conforme a <strong className="text-foreground">LGPD</strong>.
        </span>
      </label>
    </div>
  )
}
