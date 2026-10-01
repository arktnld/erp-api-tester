'use client'

import { useState } from 'react'
import { useEndpointExecute } from './use-endpoint-execute'
import { flattenJson, resolveFromFlat } from '@/lib/json-path'

type FieldSchema = {
  id: number
  fieldName: string
  label: string
  fieldType: string
  required: boolean
  sourceEndpointId: number | null
  endpointParam: string
  responsePath: string
}
type Endpoint = {
  id: number
  name: string
  method: string
  pathTemplate: string
  bodyTemplate: string | null
}
type ERP = {
  id: number
  name: string
  fieldSchemas: FieldSchema[]
  endpoints: Endpoint[]
}
type Company = {
  id: number
  name: string
  baseUrl: string
  authType: string
  erp: ERP
}

export function useClientAutoFill(
  company: Company,
  fieldValues: Record<string, string>,
  setFieldValues: React.Dispatch<React.SetStateAction<Record<string, string>>>
) {
  const runEndpoint = useEndpointExecute()

  const endpointGroups = (() => {
    const map = new Map<string, { endpointId: number; param: string; endpointName: string; fields: FieldSchema[] }>()
    company.erp.fieldSchemas.forEach((fs) => {
      if (!fs.sourceEndpointId || !fs.endpointParam) return
      const key = `${fs.sourceEndpointId}::${fs.endpointParam}`
      if (!map.has(key)) {
        const ep = company.erp.endpoints.find((e) => e.id === fs.sourceEndpointId)
        map.set(key, { endpointId: fs.sourceEndpointId, param: fs.endpointParam, endpointName: ep?.name ?? '', fields: [] })
      }
      map.get(key)!.fields.push(fs)
    })
    return [...map.values()]
  })()

  const allParams = [...new Set(endpointGroups.map((g) => g.param).filter((p) => p !== ''))]
  const uniqueParams = allParams.filter((p) => {
    const fieldSource = company.erp.fieldSchemas.find((fs) => fs.fieldName === p && fs.sourceEndpointId)
    if (!fieldSource) return true
    const sourceGroup = endpointGroups.find((g) => g.endpointId === fieldSource.sourceEndpointId)
    return sourceGroup?.param === p
  })

  const autoFillFields = new Set(
    company.erp.fieldSchemas.filter((fs) => fs.sourceEndpointId).map((fs) => fs.fieldName)
  )

  const [identifiers, setIdentifiers] = useState<Record<string, string>>(() =>
    Object.fromEntries(uniqueParams.map((p) => [p, '']))
  )
  const [fetchOpen, setFetchOpen] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(false)
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [fetchError, setFetchError] = useState('')
  const [filledCount, setFilledCount] = useState(0)
  const [fetchMissing, setFetchMissing] = useState<Set<string>>(new Set())

  const handleFetch = async () => {
    setFetchLoading(true)
    setFetchStatus('idle')
    setFetchError('')
    setFetchMissing(new Set())

    const pool: Record<string, string> = {}
    Object.entries(identifiers).forEach(([k, v]) => { if (v) pool[k] = v })
    Object.entries(fieldValues).forEach(([k, v]) => {
      if (!autoFillFields.has(k) && v) pool[k] = v
    })

    const executed = new Set<string>()
    let totalFilled = 0
    let lastError = ''

    try {
      let progress = true
      while (progress) {
        progress = false
        for (const group of endpointGroups) {
          const key = `${group.endpointId}::${group.param}`
          if (executed.has(key)) continue
          const paramValue = group.param ? pool[group.param] : undefined
          if (group.param && !paramValue) continue

          executed.add(key)
          try {
            const parsed = await runEndpoint({
              endpointId: group.endpointId,
              companyId: company.id,
              inlineFields: group.param ? { [group.param]: paramValue! } : {},
            })
            const flat = flattenJson(parsed)

            group.fields.forEach((fs) => {
              if (!fs.responsePath) return
              const value = resolveFromFlat(flat, fs.responsePath)
              if (value) {
                pool[fs.fieldName] = value
                totalFilled++
                progress = true
              }
            })
          } catch (err) {
            lastError = String(err)
          }
        }
      }

      setFieldValues((prev) => {
        const next = { ...prev }
        autoFillFields.forEach((name) => { next[name] = '' })
        Object.assign(next, pool)
        return next
      })
      setFilledCount(totalFilled)
      if (lastError && totalFilled === 0) setFetchError(lastError)

      const missing = new Set<string>()
      company.erp.fieldSchemas.forEach((fs) => {
        if (fs.sourceEndpointId && fs.responsePath && !pool[fs.fieldName]) {
          missing.add(fs.fieldName)
        }
      })
      setFetchMissing(missing)
      setFetchStatus('ok')
    } catch (err) {
      setFetchError(String(err))
      setFetchStatus('error')
    } finally {
      setFetchLoading(false)
    }
  }

  return {
    endpointGroups,
    uniqueParams,
    autoFillFields,
    identifiers,
    setIdentifiers,
    fetchOpen,
    setFetchOpen,
    fetchLoading,
    fetchStatus,
    fetchError,
    filledCount,
    fetchMissing,
    setFetchMissing,
    handleFetch,
  }
}
