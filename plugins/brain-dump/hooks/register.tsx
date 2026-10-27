import { atom, read, update } from 'claude-code'
import type { EngineInterface, PromptSubmitInput, Register } from 'claude-code'

import type { BrainDumpDraft } from '../types'

const draft = atom({ plugin: 'brain-dump', key: 'draft' } as const, null)
const answers = atom({ plugin: 'brain-dump', key: 'answers' } as const, [])
const isSorting = atom({ plugin: 'brain-dump', key: 'isSorting' } as const, false)

const OFF_KEY = 'off'
const GO = /^\s*go:\s*/i
const TS = String.raw`(?:\d{1,2}:)?\d{1,2}:\d{2}`
const MARK = new RegExp(
  String.raw`(?:\b(?:at|around)\s+)?\b${TS}(?:\s*(?:-|–|to|until)\s*${TS})?\b`,
  'gi',
)

const SORT_RULES = `You sort a founder's dictated ramble into a clean brief for Claude Code.
Answer with JSON only, no fences: {"goal": string, "facts": string[], "asks": string[], "questions": string[], "clean": string}
- goal: one sentence, what he wants in the end.
- facts: the context and constraints he gave, short lines.
- asks: what he wants done, in his order.
- questions: 0 to 3. Only where his words could really be read two ways and a wrong guess would waste the work. Never ask what he already said. Short, plain words. Usually 0 or 1.
- clean: the whole prompt rewritten in his voice, first person, plain and direct: the goal, then the context, then the asks numbered.
Keep every fact, ask, name, number and constraint. Invent nothing. Drop only filler and repeats. No em dashes.`

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'brain-dump',
      description: 'Turn Brain Dump on or off',
    })

    return next(e)
  })

  on('command.run', { command: 'brain-dump' }, async $ => {
    const isOff = !(await $.store.get(OFF_KEY))
    await $.store.set(OFF_KEY, isOff)

    return { text: isOff ? 'Brain Dump is off' : 'Brain Dump is on' }
  })

  on('prompt.submit', async ($, e, next) => {
    if (!isPersons(e)) return next(e)
    if (GO.test(e.text)) return next(e)
    if (await $.store.get(OFF_KEY)) return next(e)

    const notes = splitNotes(e.text)
    if (notes.length >= 2) {
      $.ui.toast(`Brain Dump: ${notes.length} notes, numbered`)

      return next({ ...e, context: [...(e.context ?? []), notesContext(notes)] })
    }

    // Typed mid-turn, or carrying images a resend would lose: never held.
    if (!isLong(e.text) || e.turnId !== undefined || (e.attachments?.length ?? 0) > 0) {
      return next(e)
    }

    const text = e.text
    await update($, draft, () => null)
    await update($, isSorting, () => true)
    $.clock.after(1, () => void sort($, text))

    return { drop: 'Brain Dump is sorting this. One sec.' }
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey) return below
    if (e.surface !== 'terminal' && e.surface !== 'desktop') return below

    const sorting = await read($, isSorting)
    const current = await read($, draft)
    if (!sorting && current === null) return below

    const { Box, Button, Input, Text } = $.ui.resolve(e)

    if (current === null) {
      return (
        <Box flexDirection="column">
          <Text dimColor>Brain Dump is sorting your message...</Text>
          {below}
        </Box>
      )
    }

    const given = await read($, answers)

    return (
      <Box flexDirection="column">
        <Text bold>Brain Dump</Text>
        <Text>
          <Text bold>Goal: </Text>
          {current.goal}
        </Text>
        {current.facts.length > 0 && <Text bold>Facts</Text>}
        {current.facts.map(fact => (
          <Text dimColor>- {fact}</Text>
        ))}
        {current.asks.length > 0 && <Text bold>Asks</Text>}
        {current.asks.map((ask, i) => (
          <Text>
            {i + 1}. {ask}
          </Text>
        ))}
        {current.questions.length === 0 && <Text dimColor>No questions, it reads clear.</Text>}
        {current.questions.map((question, i) => (
          <Input
            key={`q${i}`}
            label={`${question} `}
            placeholder="your answer, or leave it empty"
            value={given[i] ?? ''}
            submitLabel="save"
            onInput={value => void setAnswer($, i, value)}
            onSubmit={value => void setAnswer($, i, value)}
          />
        ))}
        <Box flexDirection="row" gap={1}>
          <Button
            key="send"
            label="Send"
            hotkey="s"
            variant="primary"
            onPress={() => void sendClean($)}
          />
          <Button key="original" label="Send my words" onPress={() => void sendOriginal($)} />
          <Button key="edit" label="Edit" onPress={() => void editClean($)} />
        </Box>
        {below}
      </Box>
    )
  })
}

function isPersons(e: PromptSubmitInput): boolean {
  const isTyped = e.origin.kind === 'composer' || e.origin.kind === 'bridge'

  return isTyped && e.isMeta === undefined && e.command === undefined
}

function isLong(text: string): boolean {
  return text.length >= 700 || text.trim().split(/\s+/).length >= 120
}

function splitNotes(text: string): string[] {
  const starts = [...text.matchAll(MARK)].map(match => match.index ?? 0)
  if (starts.length < 2) return []

  return starts.map((start, i) => text.slice(start, starts[i + 1] ?? text.length).trim())
}

function notesContext(notes: string[]): string {
  const list = notes.map((note, i) => `${i + 1}. ${note}`).join('\n')

  return `Brain Dump numbered these editing notes from his message. Work through every one, in order, and ask no questions: take your best read where one is unclear and say what you chose. When you are done, report back ticking each by its number (for example "1 done"), and say plainly which one could not be done and why.\n\n${list}`
}

function originalContext(original: string): string {
  return `His original words, before Brain Dump sorted them into the prompt that follows. Work from that prompt; use these only for any detail it left out.\n\n${original}`
}

// The model reads his original words beside the clean prompt; he never sees the row.
async function keepOriginal($: EngineInterface, original: string) {
  try {
    await $.session.append({
      message: { type: 'user', content: [{ type: 'text', text: originalContext(original) }] },
    })
  } catch {
    // Refused: the clean prompt still goes, it holds every fact.
  }
}

async function setAnswer($: EngineInterface, i: number, value: string) {
  await update($, answers, list => {
    const next = [...list]
    while (next.length <= i) next.push('')
    next[i] = value

    return next
  })
}

async function sort($: EngineInterface, original: string) {
  const reply = await $.model.complete({
    model: 'sonnet',
    system: SORT_RULES,
    prompt: original,
    maxTokens: 4000,
    timeoutMs: 90_000,
  })
  const sorted = reply.isAnswered ? parseDraft(reply.text, original) : null
  await update($, answers, () => [])
  await update($, isSorting, () => false)

  if (sorted === null) {
    $.ui.toast("Brain Dump couldn't sort that, so your words went as they were")
    await $.prompt.submit({ text: original, asUser: true })

    return
  }

  await update($, draft, () => sorted)
}

function parseDraft(text: string, original: string): BrainDumpDraft | null {
  const body = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  try {
    const raw: unknown = JSON.parse(body)
    if (typeof raw !== 'object' || raw === null) return null
    const { goal, facts, asks, questions, clean } = raw as Record<string, unknown>
    if (typeof goal !== 'string' || typeof clean !== 'string' || clean.trim() === '') return null

    return {
      original,
      goal,
      facts: strings(facts),
      asks: strings(asks),
      questions: strings(questions).slice(0, 3),
      clean,
    }
  } catch {
    return null
  }
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

async function compose($: EngineInterface, current: BrainDumpDraft): Promise<string> {
  const given = await read($, answers)
  const lines = current.questions
    .map((question, i) => ({ question, answer: (given[i] ?? '').trim() }))
    .filter(({ answer }) => answer !== '')
    .map(({ question, answer }) => `- ${question} ${answer}`)

  return lines.length === 0 ? current.clean : `${current.clean}\n\nMy answers:\n${lines.join('\n')}`
}

async function clear($: EngineInterface) {
  await update($, draft, () => null)
  await update($, answers, () => [])
}

async function sendClean($: EngineInterface) {
  const current = await read($, draft)
  if (current === null) return
  const text = await compose($, current)
  await clear($)
  await keepOriginal($, current.original)
  await $.prompt.submit({ text, asUser: true })
}

async function sendOriginal($: EngineInterface) {
  const current = await read($, draft)
  if (current === null) return
  await clear($)
  await $.prompt.submit({ text: current.original, asUser: true })
}

async function editClean($: EngineInterface) {
  const current = await read($, draft)
  if (current === null) return
  const text = await compose($, current)
  await clear($)
  await $.prompt.fill({ text: `go: ${text}` })
}
