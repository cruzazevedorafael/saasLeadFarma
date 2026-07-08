'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { salvarCadastro } from './actions'
import type { CadastroInput } from './schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Field = { key: keyof CadastroInput; label: string; placeholder?: string; className?: string; required?: boolean }

const FIELDS: Field[] = [
  { key: 'nomeFantasia', label: 'Nome da farmácia (aparece pro cliente)', className: 'sm:col-span-2', required: true },
  { key: 'whatsappNumber', label: 'WhatsApp que recebe os pedidos (com DDD)', placeholder: '5511999998888', className: 'sm:col-span-2', required: true },
  { key: 'razaoSocial', label: 'Razão social', className: 'sm:col-span-2', required: true },
  { key: 'cnpj', label: 'CNPJ', placeholder: '00.000.000/0000-00', required: true },
  { key: 'crf', label: 'CRF (farmacêutico)', required: true },
  { key: 'farmaceuticoResponsavel', label: 'Farmacêutico responsável', className: 'sm:col-span-2', required: true },
  { key: 'cep', label: 'CEP', placeholder: '00000-000', required: true },
  { key: 'logradouro', label: 'Logradouro', className: 'sm:col-span-2', required: true },
  { key: 'numero', label: 'Número' },
  { key: 'bairro', label: 'Bairro', required: true },
  { key: 'cidade', label: 'Cidade', required: true },
  { key: 'uf', label: 'UF', placeholder: 'SP', required: true },
  { key: 'telefone', label: 'Telefone', required: true },
  { key: 'email', label: 'E-mail', required: true },
]

export function CadastroForm({ initial }: { initial: Partial<CadastroInput> }) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, (initial[f.key] as string) ?? ''])),
  )
  const [erro, setErro] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErro(null)
    try {
      const r = await salvarCadastro(values as unknown as CadastroInput)
      if (!r.ok) {
        setErro(r.error)
        return
      }
      router.push('/painel')
      router.refresh()
    } catch {
      setErro('Não foi possível salvar agora. Tente novamente em instantes.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {FIELDS.map((f) => (
        <div key={f.key} className={`space-y-1 ${f.className ?? ''}`}>
          <Label htmlFor={f.key}>
            {f.label}{f.required
              ? <span className="text-[#F97316]"> *</span>
              : <span className="text-muted-foreground text-xs"> (opcional)</span>}
          </Label>
          <Input
            id={f.key}
            value={values[f.key]}
            placeholder={f.placeholder}
            onChange={(e) => set(f.key, e.target.value)}
          />
        </div>
      ))}
      {erro && <p className="sm:col-span-2 text-sm text-destructive">{erro}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={saving} className="bg-[#F97316] hover:opacity-90 text-white">
          {saving ? 'Salvando...' : 'Salvar e continuar'}
        </Button>
      </div>
    </form>
  )
}
