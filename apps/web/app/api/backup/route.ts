import { prisma } from '@erp/db'
import { NextResponse } from 'next/server'
import { requireAdmin, UnauthorizedError } from '@/lib/require-role'

export async function GET() {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 403 })
    throw err
  }
  const erps = await prisma.eRP.findMany({
      orderBy: { name: 'asc' },
      include: {
        endpoints: { orderBy: { sortOrder: 'asc' } },
        fieldSchemas: { orderBy: { sortOrder: 'asc' } },
        companies: {
          orderBy: { name: 'asc' },
          include: {
            testClients: { orderBy: { name: 'asc' } },
          },
        },
      },
    })

  const backup = {
    exportedAt: new Date().toISOString(),
    version: 1,
    erps: erps.map((erp) => ({
      name: erp.name,
      fieldSchemas: erp.fieldSchemas.map((fs) => ({
        fieldName: fs.fieldName,
        label: fs.label,
        fieldType: fs.fieldType,
        required: fs.required,
        sortOrder: fs.sortOrder,
        sourceEndpointId: fs.sourceEndpointId,
        endpointParam: fs.endpointParam,
        responsePath: fs.responsePath,
      })),
      endpoints: erp.endpoints.map((ep) => ({
        name: ep.name,
        method: ep.method,
        pathTemplate: ep.pathTemplate,
        bodyTemplate: ep.bodyTemplate,
        headers: ep.headers,
        sortOrder: ep.sortOrder,
        group: ep.group,
        requiresClient: ep.requiresClient,
        isModification: ep.isModification,
      })),
      companies: erp.companies.map((co) => ({
        name: co.name,
        baseUrl: co.baseUrl,
        environments: co.environments,
        authType: co.authType,
        authConfig: co.authConfig,
        testClients: co.testClients.map((tc) => ({
          name: tc.name,
          fieldsData: tc.fieldsData,
        })),
      })),
    })),
  }

  const date = new Date().toISOString().slice(0, 10)
  const filename = `backup-${date}.json`

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
