export type HelperStatus = 'running' | 'done' | 'stopped' | 'failed'

export type Helper = {
  id: string
  agentId?: string
  glyph: string
  description: string
  model?: string
  status: HelperStatus
  startedAt: number
  endedAt?: number
  tokens: number
  usd: number
}

export type TodoStatus = 'pending' | 'in_progress' | 'completed'

export type Todo = { id: string; content: string; status: TodoStatus }

declare module 'claude-code' {
  interface PluginState {
    'team-tracker': {
      helpers: Helper[]
      todos: Todo[]
      tick: number
      isNewJob: boolean
    }
  }
}
