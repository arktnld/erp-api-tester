'use client'

export function useEndpointExecute() {
  return async function execute(params: {
    endpointId: number
    companyId: number
    inlineFields?: Record<string, string>
  }): Promise<unknown> {
    const res = await fetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    const data = (await res.json()) as { error?: string; responseBody: string }
    if (data.error) throw new Error(data.error)
    return JSON.parse(data.responseBody)
  }
}
