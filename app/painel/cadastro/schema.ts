// Schema do cadastro da farmácia. Fica FORA do arquivo 'use server' — um arquivo
// 'use server' só pode exportar funções async; exportar o schema (objeto) de lá
// quebra o módulo da action (POST 500). Por isso mora aqui.
import { z } from 'zod'

// Campos do cadastro da farmácia. Todos importantes (vão nos comprovantes), com
// mensagem clara por campo. 'numero' é opcional (endereços "S/N").
export const cadastroSchema = z.object({
  nomeFantasia: z.string().trim().min(2, 'Informe o nome da farmácia'),
  whatsappNumber: z.string().trim().min(10, 'Informe o WhatsApp com DDD (ex.: 5511999998888)'),
  razaoSocial: z.string().trim().min(2, 'Informe a razão social'),
  cnpj: z.string().trim().min(11, 'Informe o CNPJ'),
  cep: z.string().trim().min(8, 'Informe o CEP'),
  logradouro: z.string().trim().min(2, 'Informe o logradouro (rua/avenida)'),
  numero: z.string().trim().optional().default(''),
  bairro: z.string().trim().min(2, 'Informe o bairro'),
  cidade: z.string().trim().min(2, 'Informe a cidade'),
  uf: z.string().trim().length(2, 'Informe a UF (2 letras, ex.: SP)'),
  telefone: z.string().trim().min(8, 'Informe o telefone'),
  email: z.string().trim().email('Informe um e-mail válido'),
  farmaceuticoResponsavel: z.string().trim().min(2, 'Informe o farmacêutico responsável'),
  crf: z.string().trim().min(2, 'Informe o CRF'),
})
export type CadastroInput = z.infer<typeof cadastroSchema>
