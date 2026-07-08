'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { autoCadastro, type AutoCadastroInput } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function CadastroForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AutoCadastroInput>()
  const [erro, setErro] = useState<string | null>(null)

  const onSubmit = async (data: AutoCadastroInput) => {
    setErro(null)
    // sucesso redireciona no servidor; só voltamos aqui em caso de erro.
    const r = await autoCadastro(data)
    if (r && !r.ok) setErro(r.error)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="space-y-1">
        <Label htmlFor="nomeFantasia">Nome da farmácia</Label>
        <Input id="nomeFantasia" placeholder="Ex.: Farmácia Bem Estar" {...register('nomeFantasia', { required: 'Informe o nome' })} />
        {errors.nomeFantasia && <p className="text-xs text-destructive">{errors.nomeFantasia.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="whatsapp">WhatsApp (recebe os pedidos)</Label>
        <Input id="whatsapp" inputMode="tel" placeholder="5511999998888" {...register('whatsapp')} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="emailAdmin">E-mail de acesso</Label>
        <Input id="emailAdmin" type="email" autoComplete="email" placeholder="voce@farmacia.com" {...register('emailAdmin', { required: 'Informe o e-mail' })} />
        {errors.emailAdmin && <p className="text-xs text-destructive">{errors.emailAdmin.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="senhaAdmin">Senha</Label>
        <Input id="senhaAdmin" type="password" autoComplete="new-password" placeholder="mínimo 6 caracteres" {...register('senhaAdmin', { required: 'Crie uma senha', minLength: { value: 6, message: 'Mínimo 6 caracteres' } })} />
        {errors.senhaAdmin && <p className="text-xs text-destructive">{errors.senhaAdmin.message}</p>}
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <Button type="submit" disabled={isSubmitting} className="w-full h-12 bg-[#F97316] hover:bg-[#ea6a04] text-black font-semibold">
        {isSubmitting ? 'Criando...' : 'Começar teste grátis de 14 dias'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Sem cartão. Você configura os dados da farmácia no primeiro acesso.
      </p>
    </form>
  )
}
