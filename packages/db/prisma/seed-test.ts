/**
 * Seed de dados de teste usando httpbin.org
 * Uso: cd packages/db && npx tsx prisma/seed-test.ts
 */

import { PrismaClient } from '../src/generated'

const prisma = new PrismaClient()

async function main() {
  console.log('Criando ERP de teste...')

  // ERP
  const erp = await prisma.eRP.upsert({
    where: { name: 'Test API (HTTPBin)' },
    update: {},
    create: { name: 'Test API (HTTPBin)' },
  })

  // Company
  const company = await prisma.company.create({
    data: {
      name: 'HTTPBin.org',
      erpId: erp.id,
      baseUrl: 'https://httpbin.org',
      authType: 'none',
      authConfig: '{}',
      environments: JSON.stringify([
        { name: 'Produção', url: 'https://httpbin.org' },
      ]),
    },
  })

  // TestClient (sem campos — HTTPBin não precisa de auth)
  await prisma.testClient.create({
    data: {
      name: 'Cliente Teste',
      companyId: company.id,
      fieldsData: '{}',
    },
  })

  // Endpoints
  const endpoints = [
    {
      name: 'JSON Response',
      method: 'GET',
      pathTemplate: '/json',
      bodyTemplate: '',
      group: 'Formatos',
      requiresClient: false,
      isModification: false,
    },
    {
      name: 'POST com Body',
      method: 'POST',
      pathTemplate: '/post',
      bodyTemplate: JSON.stringify({ nome: 'Teste', valor: 123, ativo: true }, null, 2),
      group: 'Formatos',
      requiresClient: false,
      isModification: false,
    },
    {
      name: 'XML Response',
      method: 'GET',
      pathTemplate: '/xml',
      bodyTemplate: '',
      group: 'Formatos',
      requiresClient: false,
      isModification: false,
    },
    {
      name: 'HTML Response',
      method: 'GET',
      pathTemplate: '/html',
      bodyTemplate: '',
      group: 'Formatos',
      requiresClient: false,
      isModification: false,
    },
    {
      name: 'Imagem PNG',
      method: 'GET',
      pathTemplate: '/image/png',
      bodyTemplate: '',
      group: 'Binários',
      requiresClient: false,
      isModification: false,
    },
    {
      name: 'Imagem JPEG',
      method: 'GET',
      pathTemplate: '/image/jpeg',
      bodyTemplate: '',
      group: 'Binários',
      requiresClient: false,
      isModification: false,
    },
    {
      name: 'PDF (binário)',
      method: 'GET',
      pathTemplate: '/bytes/2048',
      bodyTemplate: '',
      group: 'Binários',
      requiresClient: false,
      isModification: false,
    },
    {
      name: 'Status 200 OK',
      method: 'GET',
      pathTemplate: '/status/200',
      bodyTemplate: '',
      group: 'Status Codes',
      requiresClient: false,
      isModification: false,
    },
    {
      name: 'Status 400 Bad Request',
      method: 'GET',
      pathTemplate: '/status/400',
      bodyTemplate: '',
      group: 'Status Codes',
      requiresClient: false,
      isModification: false,
    },
    {
      name: 'Status 404 Not Found',
      method: 'GET',
      pathTemplate: '/status/404',
      bodyTemplate: '',
      group: 'Status Codes',
      requiresClient: false,
      isModification: false,
    },
    {
      name: 'Status 500 Server Error',
      method: 'GET',
      pathTemplate: '/status/500',
      bodyTemplate: '',
      group: 'Status Codes',
      requiresClient: false,
      isModification: false,
    },
    {
      name: 'Redirect 302',
      method: 'GET',
      pathTemplate: '/redirect/1',
      bodyTemplate: '',
      group: 'Status Codes',
      requiresClient: false,
      isModification: false,
    },
  ]

  for (const [i, ep] of endpoints.entries()) {
    await prisma.endpoint.create({
      data: { ...ep, erpId: erp.id, sortOrder: i },
    })
  }

  console.log(`✓ ERP criado: ${erp.name} (id=${erp.id})`)
  console.log(`✓ Empresa criada: ${company.name} (id=${company.id})`)
  console.log(`✓ ${endpoints.length} endpoints criados`)
  console.log('\nAbra o app e selecione "Test API (HTTPBin)" para testar.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
