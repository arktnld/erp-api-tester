import { z } from 'zod'

export const ERPSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(100),
})

export const CompanySchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(100),
  erpId: z.number().int().positive(),
  baseUrl: z.string().url('URL inválida'),
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
