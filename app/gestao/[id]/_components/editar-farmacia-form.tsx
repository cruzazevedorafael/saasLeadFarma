'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Pharmacy } from '@/lib/data/pharmacy'
import { editarFarmacia } from '../../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Campos editáveis (snake_case = coluna no banco). Mapeados a partir do Pharmacy.
type Campo = { key: string; label: string; type?: string; maxLength?: number; placeholder?: string }

export function EditarFarmaciaForm({ pharmacy }: { pharmacy: Pharmacy }) {
  const router = useRouter()
  const [form, setForm] = useState<Record<string, string>>({
    razao_social: pharmacy.razaoSocial ?? '',
    nome_fantasia: pharmacy.nomeFantasia ?? '',
    nome_exibicao: pharmacy.nomeExibicao ?? '',
    cnpj: pharmacy.cnpj ?? '',
    cep: pharmacy.cep ?? '',
    logradouro: pharmacy.logradouro ?? '',
    numero: pharmacy.numero ?? '',
    bairro: pharmacy.bairro ?? '',
    cidade: pharmacy.cidade ?? '',
    uf: pharmacy.uf ?? '',
    telefone: pharmacy.telefone ?? '',
    email: pharmacy.email ?? '',
    farmaceutico_responsavel: pharmacy.farmaceuticoResponsavel ?? '',
    crf: pharmacy.crf ?? '',
    whatsapp_number: pharmacy.whatsappNumber ?? '',
    wholesale_threshold: String(pharmacy.wholesaleThreshold ?? 4),
  })
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [saving, setSaving] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErro(null); setOk(false)
    const patch = { ...form, wholesale_threshold: Number(form.wholesale_threshold) }
    const r = await editarFarmacia(pharmacy.id, patch)
    if (!r.ok) { setErro(r.error); setSaving(false); return }
    setOk(true); setSaving(false)
    router.refresh()
  }

  const marca: Campo[] = [
    { key: 'nome_exibicao', label: 'Nome de exibição (catálogo)' },
    { key: 'nome_fantasia', label: 'Nome fantasia' },
    { key: 'whatsapp_number', label: 'WhatsApp (pedidos)', placeholder: '5599999999999' },
    { key: 'wholesale_threshold', label: 'Qtde. para preço de atacado', type: 'number' },
  ]
  const legal: Campo[] = [
    { key: 'razao_social', label: 'Razão social' },
    { key: 'cnpj', label: 'CNPJ' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'email', label: 'E-mail', type: 'email' },
    { key: 'farmaceutico_responsavel', label: 'Farmacêutico responsável' },
    { key: 'crf', label: 'CRF' },
  ]
  const endereco: Campo[] = [
    { key: 'cep', label: 'CEP' },
    { key: 'logradouro', label: 'Logradouro' },
    { key: 'numero', label: 'Número', maxLength: 20 },
    { key: 'bairro', label: 'Bairro' },
    { key: 'cidade', label: 'Cidade' },
    { key: 'uf', label: 'UF', maxLength: 2 },
  ]

  const renderCampos = (campos: Campo[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {campos.map((c) => (
        <div key={c.key} className="space-y-1">
          <Label htmlFor={c.key}>{c.label}</Label>
          <Input
            id={c.key}
            type={c.type ?? 'text'}
            value={form[c.key]}
            onChange={set(c.key)}
            maxLength={c.maxLength}
            placeholder={c.placeholder}
            min={c.type === 'number' ? 1 : undefined}
          />
        </div>
      ))}
    </div>
  )

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-border p-4 space-y-6">
      <h2 className="font-semibold">Editar dados da farmácia</h2>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Marca e operação</h3>
        {renderCampos(marca)}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Dados legais</h3>
        {renderCampos(legal)}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Endereço</h3>
        {renderCampos(endereco)}
      </section>

      {erro && <p className="text-sm text-destructive">{erro}</p>}
      {ok && <p className="text-sm text-emerald-600">Dados salvos.</p>}

      <Button type="submit" disabled={saving} className="bg-[#F97316] hover:opacity-90 text-white">
        {saving ? 'Salvando...' : 'Salvar alterações'}
      </Button>
    </form>
  )
}
