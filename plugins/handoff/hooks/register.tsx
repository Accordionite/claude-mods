// Handoff: /handoff (or the offer band once a chat passes 60% full) asks
// Claude, over this chat, for a note: what's done, what's next, what's unsure,
// which files matter and what to keep in mind. The note is saved under
// .claude/handoffs/ and a fresh chat starts from it (a /clear, then the note as
// its first message). One model call per handoff.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { HandoffNote } from '../types'

const OFFER_AT = 60

const percent = atom({ plugin: 'handoff', key: 'percent' } as const, null)
const quietFrom = atom({ plugin: 'handoff', key: 'quietFrom' } as const, 0)
const isBusy = atom({ plugin: 'handoff', key: 'isBusy' } as const, false)

const ASK = [
  'Write a handoff note so a fresh chat can carry on this work without this conversation.',
  'Answer with JSON only, no prose and no code fence, in exactly this shape:',
  '{"did": [], "next": [], "unsure": [], "files": [], "keep": []}',
  'did: what is done, concrete. next: what comes next, in order.',
  'unsure: open questions, guesses not checked yet, anything waiting on the person.',
  'files: the file paths that matter for the next step, relative to the project.',
  "keep: the person's preferences, corrections and notes from this chat that still apply.",
  'Each item one short plain sentence. No em dashes.',
].join('\n')

// The opening waits here between the /clear and the fresh chat's first message.
let pendingOpening: string | null = null
let isCleared = false

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '') : []

export function parseNote(text: string): HandoffNote | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
    const note = {
      did: strings(raw.did),
      next: strings(raw.next),
      unsure: strings(raw.unsure),
      files: strings(raw.files),
      keep: strings(raw.keep),
    }
    return note.did.length + note.next.length === 0 ? null : note
  } catch {
    return null
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

// This machine's own time zone: Intl when it can, else the Date local getters.
function stamp(ms: number): { file: string; human: string } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(ms))
    const part = (type: string) => parts.find(p => p.type === type)?.value ?? '00'
    const day = `${part('year')}-${part('month')}-${part('day')}`
    return { file: `${day}-${part('hour')}${part('minute')}`, human: `${day} ${part('hour')}:${part('minute')}` }
  } catch {
    const at = new Date(ms)
    const day = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
    return { file: `${day}-${pad(at.getHours())}${pad(at.getMinutes())}`, human: `${day} ${pad(at.getHours())}:${pad(at.getMinutes())}` }
  }
}

const section = (title: string, items: string[]) =>
  items.length === 0 ? '' : `## ${title}\n${items.map(item => `- ${item}`).join('\n')}\n\n`

export function renderNote(note: HandoffNote, when: string, chat: string): string {
  return (
    `# Handoff note\n\n${when} · from chat ${chat}\n\n` +
    section('Done', note.did) +
    section('Next', note.next) +
    section('Unsure', note.unsure) +
    section('Files that matter', note.files) +
    section('Keep in mind', note.keep)
  ).trimEnd() + '\n'
}

async function writeHandoff($: EngineInterface): Promise<{ path: string; opening: string } | { error: string }> {
  const asked = await $.model.fork({ prompt: ASK })
  if (!asked.isAnswered) {
    return {
      error:
        asked.reason === 'nothing-to-fork'
          ? 'this chat has nothing to hand off yet.'
          : `Claude couldn't write the note (${asked.reason}).`,
    }
  }
  const note = parseNote(asked.text)
  if (note === null) return { error: "Claude's note came back in a shape I couldn't read. Try again." }

  const root = await $.session.root()
  const sessionId = await $.session.id()
  const when = stamp(await $.clock.now())
  const id8 = sessionId.replace(/^local_/, '').slice(0, 8)
  const rel = `.claude/handoffs/${when.file}-${id8}.md`
  const text = renderNote(note, when.human, id8)
  await $.fs.write(`${root}/${rel}`, text)
  return { path: rel, opening: `Picking up from a handoff note. Read it and carry on: ${rel}\n\n${text}` }
}

async function fallBack($: EngineInterface, opening: string, path: string) {
  pendingOpening = null
  const copied = await $.ui.copy({ text: opening })
  $.ui.toast(
    copied.isCopied
      ? 'Handoff saved. Open a new chat and paste.'
      : `Handoff saved to ${path}. Open a new chat and tell it to read that note.`,
  )
}

// Starts over: a /clear, then (once session.end says the clear happened) the
// note as the fresh chat's first message. Anything that stops it falls back.
// Runs from a timer after /handoff answered.
async function startFresh($: EngineInterface, opening: string, path: string) {
  const names = (await $.command.list()).map(command => command.name)
  if (!names.includes('clear')) return fallBack($, opening, path)
  pendingOpening = opening
  isCleared = false
  $.command.run({ command: 'clear' }).then(
    () => {
      if (!isCleared) void fallBack($, opening, path)
    },
    () => void fallBack($, opening, path),
  )
}

async function sendOpening($: EngineInterface, opening: string) {
  try {
    const sent = await $.prompt.submit({ text: opening })
    if (sent.drop !== undefined) await fallBack($, opening, 'the handoffs folder')
  } catch {
    await fallBack($, opening, 'the handoffs folder')
  }
}

async function runHandoff($: EngineInterface) {
  try {
    await $.command.run({ command: 'handoff' })
  } catch {
    $.ui.toast('Type /handoff to hand off this chat.')
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'handoff',
      description: "Write what's done, what's next and what's unsure, then start a fresh chat from it",
    })
    const usage = await $.session.usage()
    if (usage.context.percent !== undefined) await update($, percent, () => usage.context.percent ?? null)
    return next(e)
  })

  on('command.run', { command: 'handoff' }, async $ => {
    if (await read($, isBusy)) return { text: 'A handoff note is already being written.' }
    await update($, isBusy, () => true)
    $.ui.status('Writing the handoff note...')
    try {
      const made = await writeHandoff($)
      if ('error' in made) return { text: `Handoff didn't work: ${made.error}` }
      // Not from inside this hook: the engine refuses a command run while a command runs.
      $.clock.after(300, () => void startFresh($, made.opening, made.path))
      return { text: `Handoff note saved to ${made.path}. Starting a fresh chat from it.` }
    } finally {
      $.ui.status(undefined)
      await update($, isBusy, () => false)
    }
  })

  on('session.measure', async ($, e, next) => {
    if (e.context.percent !== undefined) await update($, percent, () => e.context.percent ?? null)
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    const ended = await next(e)
    if (e.reason === 'clear') {
      await update($, percent, () => null)
      await update($, quietFrom, () => 0)
      if (pendingOpening !== null) {
        const opening = pendingOpening
        pendingOpening = null
        isCleared = true
        $.clock.after(250, () => void sendOpening($, opening))
      }
    }
    return ended
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey || e.props.isWorking || e.props.view.agentId !== undefined) return below

    const fill = await read($, percent)
    const quiet = await read($, quietFrom)
    if (fill === null || fill < Math.max(OFFER_AT, quiet) || (await read($, isBusy))) return below

    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Box>
          <Text>This chat is getting long ({fill}% full). Hand off to a fresh one? </Text>
          <Button key="handoff" label="Hand off" hotkey="h" variant="primary" onPress={() => void runHandoff($)} />
          <Button key="later" label="Not now" plain dimColor onPress={() => void update($, quietFrom, () => fill + 10)} />
        </Box>
        {below}
      </Box>
    )
  })
}
