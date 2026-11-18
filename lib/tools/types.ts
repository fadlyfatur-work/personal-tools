export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'
export type ToolsWorkspace = { id: string; name: string; role: WorkspaceRole }
export type ToolsContext = { userId: string; email: string; name: string; workspaceId: string; role: WorkspaceRole; isTemplateAdmin: boolean; isSuiteAdmin: boolean; workspaces: ToolsWorkspace[] }
