export type HandoffNote = { did: string[]; next: string[]; unsure: string[]; files: string[]; keep: string[] }

declare module 'claude-code' {
  interface PluginState {
    handoff: { percent: number | null; quietFrom: number; isBusy: boolean }
  }
}
