import { describe, it, expect } from 'vitest'
import { parseOpenApi } from './openapi-import'

const openapi3 = {
  openapi: '3.0.1',
  servers: [{ url: 'https://erp.example.com/api/v1' }],
  components: {
    schemas: {
      Cliente: { type: 'object', properties: { nome: { type: 'string', example: 'Fulano' }, ativo: { type: 'boolean' }, contatos: { type: 'array', items: { $ref: '#/components/schemas/Contato' } } } },
      Contato: { type: 'object', properties: { tipo: { type: 'string', enum: ['email', 'fone'] } } },
    },
    parameters: { Pagina: { name: 'pagina', in: 'query', required: true, schema: { type: 'integer' } } },
  },
  paths: {
    '/clientes/{cliente-id}': {
      parameters: [{ name: 'cliente-id', in: 'path', required: true }],
      get: { summary: 'Buscar cliente', tags: ['Cliente'], parameters: [{ $ref: '#/components/parameters/Pagina' }, { name: 'filtro', in: 'query' }] },
      put: {
        operationId: 'atualizarCliente',
        parameters: [{ name: 'X-Tenant', in: 'header', required: true }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Cliente' } } } },
      },
    },
    '/upload': { post: { requestBody: { content: { 'multipart/form-data': { schema: {} } } } } },
  },
}

describe('parseOpenApi', () => {
  const { endpoints, warnings } = parseOpenApi(openapi3)
  const [get, put, upload] = endpoints

  it('maps method, name, group and base path with \\w placeholders', () => {
    expect(get).toMatchObject({ name: 'Buscar cliente', method: 'GET', group: 'Cliente', pathTemplate: '/api/v1/clientes/{cliente_id}?pagina={pagina}', requiresClient: true, isModification: false })
    expect(put).toMatchObject({ name: 'atualizarCliente', method: 'PUT', isModification: true })
    expect(upload.name).toBe('POST /upload')
  })

  it('builds a JSON body example from $ref schemas and required headers', () => {
    expect(JSON.parse(put.bodyTemplate)).toEqual({ nome: 'Fulano', ativo: false, contatos: [{ tipo: 'email' }] })
    expect(JSON.parse(put.headers)).toEqual({ 'Content-Type': 'application/json', 'X-Tenant': '{X_Tenant}' })
  })

  it('warns about non-JSON bodies instead of guessing', () => {
    expect(upload.bodyTemplate).toBe('')
    expect(warnings).toEqual(['POST /upload: body multipart/form-data não importado'])
  })

  it('supports Swagger 2.0 basePath and body parameters', () => {
    const { endpoints: [ep] } = parseOpenApi({
      swagger: '2.0', basePath: '/v2/',
      paths: { '/pedido': { post: { parameters: [{ in: 'body', name: 'b', schema: { type: 'object', properties: { qtd: { type: 'integer' } } } }] } } },
    })
    expect(ep).toMatchObject({ pathTemplate: '/v2/pedido', requiresClient: false })
    expect(JSON.parse(ep.bodyTemplate)).toEqual({ qtd: 0 })
  })

  it('rejects files that are not OpenAPI and survives self-referencing schemas', () => {
    expect(() => parseOpenApi({ info: {} })).toThrow('não parece OpenAPI')
    const loop = { openapi: '3.0.0', components: { schemas: { N: { type: 'object', properties: { next: { $ref: '#/components/schemas/N' } } } } },
      paths: { '/n': { post: { requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/N' } } } } } } } }
    expect(() => parseOpenApi(loop)).not.toThrow()
  })
})
