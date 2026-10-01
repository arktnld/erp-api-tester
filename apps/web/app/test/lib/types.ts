export type Endpoint = {
  id: number
  name: string
  method: string
  pathTemplate: string
  bodyTemplate: string
  headers: string
  group: string
  requiresClient: boolean
  isModification: boolean
  notes: string
}

export type TestClient = { id: number; name: string; fieldsData: Record<string, string> }

export type Company = {
  id: number
  name: string
  baseUrl: string
  environments: Environment[]
  authType: string
  authConfig: Record<string, unknown> | null
  testClients: TestClient[]
}

export type ERP = {
  id: number
  name: string
  authTemplate: unknown
  endpoints: Endpoint[]
  companies: Company[]
  fieldSchemas?: { fieldName: string; defaultValue: string }[]
}

export type Environment = { name: string; url: string }

export type ContentCategory = 'json' | 'xml' | 'html' | 'csv' | 'text' | 'image' | 'document' | 'binary'

export interface ExecuteResponse {
  statusCode: number
  url: string
  method: string
  requestBody: string | null
  requestHeaders: Record<string, string>
  responseBody: string
  responseHeaders: Record<string, string>
  durationMs: number
  contentCategory: ContentCategory
  mimeType: string
  fileName: string | null
  isBinary: boolean
}

export interface ExportData {
  method: string
  url: string
  erpName: string
  companyName: string
  status: number
  duration: number
  timestamp: Date
  requestBody?: string | null
  responseBody: string | null
  binaryMeta?: {
    mimeType: string
    sizeKB: number
    fileName: string | null
  }
}
