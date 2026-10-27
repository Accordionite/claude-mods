// Where a rule can go, with the file it is written to.
export type Place =
  | { kind: 'project'; path: string }
  | { kind: 'everywhere'; path: string }
  | { kind: 'skill'; skill: string; path: string }

export type Pending = {
  rule: string
  places: Place[]
  at: number
}

declare module 'claude-code' {
  interface PluginState {
    reflect: { pending: Pending | null }
  }
}
