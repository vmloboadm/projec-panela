import { z } from 'zod'

export const lancamentoSchema = z.object({
  tipo: z.enum(['receita', 'despesa']),
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  valor: z.number().positive('Valor deve ser positivo'),
  categoria: z.string().min(1, 'Categoria é obrigatória'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  afeta_caixa: z.boolean().optional().default(true),
  afeta_resultado: z.boolean().optional().default(true),
})

export const itemSchema = z.discriminatedUnion('tipo_registro', [
  z.object({
    tipo_registro: z.literal('lancamento'),
    id: z.string(),
    tipo: z.enum(['receita', 'despesa']),
    descricao: z.string().min(1, 'Descrição é obrigatória'),
    valor: z.number().positive('Valor deve ser positivo'),
    categoria: z.string().min(1, 'Categoria é obrigatória'),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  }),
  z.object({
    tipo_registro: z.literal('conta_a_pagar'),
    id: z.string(),
    tipo: z.enum(['receita', 'despesa']),
    descricao: z.string().min(1, 'Descrição é obrigatória'),
    valor: z.number().positive('Valor deve ser positivo'),
    categoria: z.string().min(1, 'Categoria é obrigatória'),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
    data_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de vencimento inválida'),
  }),
  z.object({
    tipo_registro: z.literal('insumo_churrasco'),
    id: z.string(),
    tipo: z.enum(['receita', 'despesa']),
    descricao: z.string().min(1, 'Descrição é obrigatória'),
    valor: z.number().positive('Valor deve ser positivo'),
    categoria: z.string().min(1, 'Categoria é obrigatória'),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
    corte_id: z.string().min(1, 'Corte é obrigatório'),
    quantidade_kg: z.number().positive('Quantidade deve ser positiva'),
    preco_kg: z.number().positive('Preço deve ser positivo'),
  }),
])

export const itemArraySchema = z.array(itemSchema).min(1, 'Adicione pelo menos um item')

export const configSchema = z.object({
  nome_restaurante: z.string().min(1).optional().default('Panela da Roça'),
  endereco: z.string().optional().default(''),
  aluguel_mensal: z.number().nonnegative(),
  funcionarios_mensal: z.number().nonnegative(),
  energia_mensal: z.number().nonnegative(),
  agua_mensal: z.number().nonnegative(),
  outros_fixos: z.number().nonnegative(),
  tolerancia_caixa: z.number().nonnegative(),
  preco_carne_padrao_kg: z.number().nonnegative(),
  meta_diaria_vendas: z.number().nonnegative(),
})

export const csvRowSchema = z.object({
  linha: z.number().int().positive(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve ser YYYY-MM-DD').or(z.literal('')),
  tipo: z.enum(['receita', 'despesa']),
  valor: z.string().min(1, 'Valor obrigatório'),
  categoria: z.string().optional().default(''),
  descricao: z.string().optional().default(''),
  conta: z.string().optional().default(''),
})

export type CsvRow = z.infer<typeof csvRowSchema>

export type ItemType = z.infer<typeof itemSchema>
export type ConfigType = z.infer<typeof configSchema>

export function getFieldErrors(result: z.ZodSafeParseError<any>, path: string): string[] {
  return result.error.issues
    .filter((i: any) => i.path.join('.') === path)
    .map((i: any) => i.message)
}

export function getFirstError(result: z.ZodSafeParseError<any>, path: string): string {
  const errs = getFieldErrors(result, path)
  return errs.length > 0 ? errs[0] : ''
}
