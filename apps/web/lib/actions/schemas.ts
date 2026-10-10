import { z } from 'zod'

export const ERPSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(100),
})

const HOSTNAME = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i

/** What is wrong with a base URL, in the user's words; null when it is usable. */
export function baseUrlProblem(value: string): string | null {
  const url = value.trim()
  if (!/^https?:\/\//i.test(url)) return 'Comece com http:// ou https://'
  if (/[\s'"`<>]/.test(url)) return 'Tire aspas e espaços do endereço'
  let host: string
  try { host = new URL(url).hostname } catch { return 'Endereço inválido (ex.: https://api.exemplo.com)' }
  // new URL() accepts hosts like "erp.example.com'"; DNS does not, and every call then fails with ENOTFOUND.
  if (!HOSTNAME.test(host) && !host.startsWith('[')) return 'Endereço inválido (ex.: https://api.exemplo.com)'
  return null
}

/** Base URL of a company: http(s) with a real host name, stored trimmed and without the trailing slash. */
export const BaseUrlSchema = z.string()
  .superRefine((v, ctx) => { const problem = baseUrlProblem(v); if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem }) })
  .transform((v) => v.trim().replace(/\/+$/, ''))

export const CompanySchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(100),
  erpId: z.number().int().positive(),
  baseUrl: BaseUrlSchema,
  environments: z.string().default('[]'),
  authType: z.enum(['none', 'bearer', 'api_key', 'basic', 'custom_headers', 'body_fields', 'token_endpoint']),
  authConfig: z.string().default('{}'),
  notes: z.string().default(''),
})

export const EndpointSchema = z.object({
  erpId: z.number().int().positive(),
  name: z.string().min(1, 'Nome obrigatório').max(100),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  pathTemplate: z.string().min(1, 'Path obrigatório'),
  bodyTemplate: z.string().default(''),
  headers: z.string().default('{}'),
  group: z.string().default(''),
  requiresClient: z.boolean().default(true),
  isModification: z.boolean().default(false),
  notes: z.string().default(''),
  authMode: z.string().default(''),
})

export const TestClientSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(100),
  companyId: z.number().int().positive(),
  fieldsData: z.string().default('{}'),
})

export const FieldSchemaSchema = z.object({
  erpId: z.number().int().positive(),
  fieldName: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  // number/email are offered in the ERP page's field form; they were rejected here before.
  fieldType: z.enum(['text', 'number', 'email', 'cpf', 'cnpj', 'date', 'select', 'auto']),
  required: z.boolean().default(false),
  sourceEndpointId: z.number().int().positive().nullable().optional(),
  endpointParam: z.string().optional(),
  responsePath: z.string().optional(),
  defaultValue: z.string().max(500).optional(),
})

export const ExecuteSchema = z.object({
  endpointId: z.number().int().positive(),
  clientId: z.number().int().positive().nullable().optional(),
  companyId: z.number().int().positive().nullable().optional(),
  environmentUrl: z.string().url().optional(),
  rawBody: z.string().optional(),
  inlineFields: z.record(z.string()).optional(),
  customUrl: z.string().url().optional(),
})
