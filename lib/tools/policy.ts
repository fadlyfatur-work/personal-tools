export const TOOLS_AUTH_COOKIE = 'personal-tools-suite-auth'
export const DEFAULT_TOOLS_RETURN = '/office/tasks'
export function safeToolsReturn(value: unknown) {
  if (typeof value !== 'string' || /[\\\s\x00-\x1f]/.test(value) || /%0[ad]|%2f|%5c/i.test(value)) return DEFAULT_TOOLS_RETURN
  if (!/^\/(office(?:\/|\?|$)|documents(?:\/|\?|$)|deployments(?:\/|\?|$)|monitoring(?:\/|\?|$)|tools\/(?:invitation|users|workspaces)(?:\?|$))/.test(value) || value.startsWith('//')) return DEFAULT_TOOLS_RETURN
  try { const url = new URL(value, 'https://suite.invalid'); return url.origin === 'https://suite.invalid' ? `${url.pathname}${url.search}` : DEFAULT_TOOLS_RETURN } catch { return DEFAULT_TOOLS_RETURN }
}
export const canWriteWorkspace = (role: string) => ['owner', 'admin', 'member'].includes(role)
export const canManageWorkspace = (role: string) => ['owner', 'admin'].includes(role)
export function isSameOriginMutation(request: Request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true
  const origin = request.headers.get('origin')
  return origin !== null && origin === new URL(request.url).origin
}
