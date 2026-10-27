export type BrainDumpDraft = {
  original: string
  goal: string
  facts: string[]
  asks: string[]
  questions: string[]
  clean: string
}

declare module 'claude-code' {
  interface PluginState {
    'brain-dump': {
      draft: BrainDumpDraft | null
      answers: string[]
      isSorting: boolean
    }
  }
}
