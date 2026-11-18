'use client'
import { useCallback, useEffect, useState } from 'react'
import type { ToolsContext } from './types'

export class ToolsRequestError extends Error {
  constructor(message: string, public status: number, public code?: string, public fieldErrors?: Record<string, string>) { super(message) }
}
export async function toolsRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: 'same-origin', cache: 'no-store' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new ToolsRequestError(body.error || 'Permintaan belum dapat diproses.', response.status, body.code, body.field_errors)
  return (Object.hasOwn(body, 'data') ? body.data : body) as T
}
export function useTools() {
  const [context, setContext] = useState<ToolsContext | null>(null)
  const [workspaceId, setWorkspace] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('workspace') || window.sessionStorage.getItem('tools:workspace') || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const reload = useCallback(() => { setLoading(true); setError(''); setAttempt(value => value + 1) }, [])
  const setWorkspaceId = useCallback((id: string) => { setContext(null); setLoading(true); setError(''); setWorkspace(id); if(id) window.sessionStorage.setItem('tools:workspace',id);else window.sessionStorage.removeItem('tools:workspace') }, [])
  useEffect(() => {
    const controller = new AbortController()
    toolsRequest<ToolsContext>('/api/tools/bootstrap', { signal: controller.signal, headers: workspaceId ? { 'x-tools-workspace': workspaceId } : {} })
      .then(data => { if (!controller.signal.aborted) setContext(data) })
      .catch(err => { if (!controller.signal.aborted) { setContext(null); setError(err.message) } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [workspaceId, attempt])
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [reload])
  return { context, workspaceId: context?.workspaceId || workspaceId, setWorkspaceId, loading, error, reload }
}
