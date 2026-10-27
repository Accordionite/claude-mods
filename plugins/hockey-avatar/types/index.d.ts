export type Mood = 'idle' | 'working' | 'goal'

declare module 'claude-code' {
  interface PluginState {
    'hockey-avatar': { mood: Mood; goals: number; shots: number; isHidden: boolean; frame: number }
  }
}
