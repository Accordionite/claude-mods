import { atom, read, update } from 'claude-code'
import type { EngineInterface, ModelUsage, Register, Timer } from 'claude-code'

import type { Helper, Todo, TodoStatus } from '../types'

const PANE = 'team'
const PLAN_TOOL = 'mcp__ccd_turn__update_plan'
const GLYPHS = ['🦊', '🐙', '🐝', '🦉', '🐢', '🦄', '🐳', '🦀']

// API list prices in dollars per million tokens (input, output). An estimate:
// on a Max plan the plan covers it. Fable has no public price here, so it is
// counted like Opus.
const PRICES: Record<string, [number, number]> = {
  opus: [5, 25],
  fable: [5, 25],
  sonnet: [3, 15],
  haiku: [1, 5],
}

const helpers = atom({ plugin: 'team-tracker', key: 'helpers' } as const, [])
const todos = atom({ plugin: 'team-tracker', key: 'todos' } as const, [])
const tick = atom({ plugin: 'team-tracker', key: 'tick' } as const, 0)
const isNewJob = atom({ plugin: 'team-tracker', key: 'isNewJob' } as const, true)

// Lost on a reload, which is fine: the ticker restarts with the next change,
// and the surface says again whether it docks panes at its next draw.
let ticker: Timer | undefined
let docks: boolean | undefined

type Usage = Partial<Record<keyof ModelUsage, number | null>>

type AgentRecord = {
  status?: string
  agentId?: string
  agent_id?: string
  totalTokens?: number
  totalDurationMs?: number
  resolvedModel?: string
  usage?: Usage
}

type PlanInput = {
  items?: { content: string; status: TodoStatus }[]
  advance?: boolean
  done?: number[]
  start?: number
}

type NewHelper = Omit<Helper, 'glyph' | 'status' | 'tokens' | 'usd'>

function priceOf(model: string | undefined): [number, number] {
  const name = (model ?? '').toLowerCase()
  const family = Object.keys(PRICES).find(one => name.includes(one))

  return PRICES[family ?? 'sonnet'] ?? [3, 15]
}

function costOf(usage: Usage, model: string | undefined) {
  const [input, output] = priceOf(model)
  const n = (k: keyof ModelUsage) => usage[k] ?? 0
  const tokens = n('input_tokens') + n('output_tokens') + n('cache_read_input_tokens') + n('cache_creation_input_tokens')
  const usd =
    (n('input_tokens') * input +
      n('output_tokens') * output +
      n('cache_read_input_tokens') * input * 0.1 +
      n('cache_creation_input_tokens') * input * 1.25) /
    1_000_000

  return { tokens, usd }
}

function duration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`

  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

function count(n: number) {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${Math.round(n / 1000)}K`

  return `${(n / 1_000_000).toFixed(1)}M`
}

function money(usd: number) {
  return usd < 0.01 ? 'under $0.01' : `$${usd.toFixed(2)}`
}

function bar(done: number, total: number, width: number) {
  const filled = total === 0 ? 0 : Math.round((done / total) * width)

  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

async function stamp($: EngineInterface) {
  const now = await $.clock.now()
  await update($, tick, () => now)
}

// The status line, and a one-second tick while any helper runs.
async function refresh($: EngineInterface) {
  const list = await read($, helpers)
  const running = list.filter(one => one.status === 'running').length
  const finished = list.length - running
  $.ui.status(running > 0 ? `Team: ${running} running, ${finished} done` : undefined)

  if (running > 0 && ticker === undefined) {
    ticker = $.clock.every(1000, () => void stamp($))
  }
  if (running === 0 && ticker !== undefined) {
    ticker.cancel()
    ticker = undefined
  }
  await stamp($)
}

async function openPane($: EngineInterface) {
  return $.ui.open({ id: PANE, title: 'Team' })
}

async function startHelper($: EngineInterface, one: NewHelper) {
  const isFresh = await read($, isNewJob)
  if (isFresh) {
    await update($, isNewJob, () => false)
    if (docks === true) void openPane($)
  }
  await update($, helpers, list => {
    const kept = isFresh ? [] : list
    if (kept.some(h => h.id === one.id)) return kept
    const glyph = GLYPHS[kept.length % GLYPHS.length] ?? '🦊'

    return [...kept, { ...one, glyph, status: 'running' as const, tokens: 0, usd: 0 }].slice(-30)
  })
  await refresh($)
}

// An agent's run reaches here by its id; a model's Agent call that has not
// answered yet is known only by its tool_use_id, so the two are linked by
// the description $.agent.list() gives the agent.
async function linkHelper($: EngineInterface, agentId: string): Promise<string> {
  const list = await read($, helpers)
  const known = list.find(one => one.agentId === agentId)
  if (known) return known.id
  const info = (await $.agent.list()).find(one => one.id === agentId)
  const unlinked = list.filter(one => one.agentId === undefined && one.status === 'running')
  const match =
    unlinked.find(one => info !== undefined && one.description === info.description) ??
    (unlinked.length === 1 ? unlinked[0] : undefined)
  if (match) {
    await update($, helpers, all => all.map(one => (one.id === match.id ? { ...one, agentId } : one)))

    return match.id
  }
  await startHelper($, {
    id: agentId,
    agentId,
    description: info?.description || info?.name || 'Helper',
    startedAt: await $.clock.now(),
  })

  return agentId
}

async function applyTodos($: EngineInterface, tool: string, input: Record<string, unknown>, result: unknown) {
  if (tool === 'TodoWrite') {
    const list = (input.todos ?? []) as { content: string; status: TodoStatus }[]
    await update($, todos, () => list.map((one, i) => ({ id: String(i), content: one.content, status: one.status })))
  }
  if (tool === 'TaskCreate') {
    const task = (result as { task?: { id?: string } } | undefined)?.task
    const made: Todo = { id: task?.id ?? `t${await $.clock.now()}`, content: String(input.subject ?? ''), status: 'pending' }
    await update($, todos, list => [...(list.every(one => one.status === 'completed') ? [] : list), made])
  }
  if (tool === 'TaskUpdate') {
    const id = String(input.taskId)
    const status = input.status as TodoStatus | 'deleted' | undefined
    const subject = typeof input.subject === 'string' ? input.subject : undefined
    await update($, todos, list =>
      status === 'deleted'
        ? list.filter(one => one.id !== id)
        : list.map(one => (one.id === id ? { ...one, status: status ?? one.status, content: subject ?? one.content } : one)),
    )
  }
  if (tool === PLAN_TOOL) {
    const plan = input as PlanInput
    await update($, todos, list => {
      if (plan.items) return plan.items.map((one, i) => ({ id: String(i), content: one.content, status: one.status }))
      let next = [...list]
      if (plan.advance) {
        const at = next.findIndex(one => one.status === 'in_progress')
        if (at >= 0) next[at] = { ...next[at]!, status: 'completed' }
        const after = next.findIndex(one => one.status === 'pending')
        if (after >= 0) next[after] = { ...next[after]!, status: 'in_progress' }
      }
      for (const n of plan.done ?? []) {
        if (next[n - 1]) next[n - 1] = { ...next[n - 1]!, status: 'completed' }
      }
      if (typeof plan.start === 'number' && next[plan.start - 1]) {
        next = next.map(one => (one.status === 'in_progress' ? { ...one, status: 'pending' as const } : one))
        next[plan.start - 1] = { ...next[plan.start - 1]!, status: 'in_progress' }
      }

      return next
    })
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: 'team', description: 'Show the Team pane: the job, its helpers, their time and cost' })
    await refresh($)

    return started
  })

  on('command.run', { command: 'team' }, async ($, e) => {
    docks = e.presentation?.isFullscreen ?? docks
    const opened = await openPane($)

    return { text: opened.isPlaced ? 'Team pane open.' : `The Team pane is waiting: ${opened.reason}` }
  })

  // A new job starts with the person's next turn once no helper is running.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const list = await read($, helpers)
      if (!list.some(one => one.status === 'running')) await update($, isNewJob, () => true)
    } else {
      await linkHelper($, e.agentId)
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      const id = await linkHelper($, e.agentId)
      const now = await $.clock.now()
      const spent = e.usage ? costOf(e.usage, e.usage.model) : { tokens: 0, usd: 0 }
      const status = e.isAborted ? ('stopped' as const) : ('done' as const)
      await update($, helpers, list =>
        list.map(one =>
          one.id === id
            ? {
                ...one,
                status,
                endedAt: now,
                model: e.usage?.model ?? one.model,
                tokens: one.tokens + spent.tokens,
                usd: one.usd + spent.usd,
              }
            : one,
        ),
      )
      await refresh($)
    }

    return next(e)
  })

  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    await startHelper($, { id: e.tool_use_id, description: e.description, model: e.model, startedAt: await $.clock.now() })
    const ran = await next(e)
    const now = await $.clock.now()

    if (ran.deny !== undefined || ran.isError) {
      await update($, helpers, list =>
        list.map(one => (one.id === e.tool_use_id ? { ...one, status: 'failed' as const, endedAt: now } : one)),
      )
    } else {
      const record = (ran.result ?? {}) as unknown as AgentRecord
      const agentId = record.agentId ?? record.agent_id
      const isFinished = record.status === 'completed' || typeof record.totalTokens === 'number'
      await update($, helpers, list =>
        list.map(one => {
          if (one.id !== e.tool_use_id && (agentId === undefined || one.agentId !== agentId)) return one
          const linked = { ...one, agentId: agentId ?? one.agentId, model: record.resolvedModel ?? one.model }
          if (!isFinished) return linked
          // The run's own turn.complete counts it exactly; this is the fallback.
          const counted = one.tokens > 0 || !record.usage ? undefined : costOf(record.usage, linked.model)
          const scale = counted && counted.tokens > 0 && record.totalTokens ? record.totalTokens / counted.tokens : 1

          return {
            ...linked,
            status: 'done' as const,
            endedAt: record.totalDurationMs ? one.startedAt + record.totalDurationMs : now,
            tokens: counted ? Math.round(counted.tokens * scale) : one.tokens,
            usd: counted ? counted.usd * scale : one.usd,
          }
        }),
      )
    }
    await refresh($)

    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    const tool = String(e.tool)
    const isTodo = tool === 'TodoWrite' || tool === 'TaskCreate' || tool === 'TaskUpdate' || tool === PLAN_TOOL
    if (isTodo && ran.deny === undefined && !ran.isError) {
      await applyTodos($, tool, e as unknown as Record<string, unknown>, ran.result)
    }

    return ran
  }).catch(($, e, next) => next(e))

  // Only watches whether this surface docks panes, so the pane opens by
  // itself only where it is a sidebar.
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    if (e.viewport?.isFullscreen !== undefined) docks = e.viewport.isFullscreen

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (e.viewport?.isFullscreen !== undefined) docks = e.viewport.isFullscreen
    const { Box, Text } = $.ui.resolve(e)
    const now = await read($, tick)
    const list = await read($, helpers)
    const steps = await read($, todos)
    const done = steps.filter(one => one.status === 'completed').length
    const current = steps.find(one => one.status === 'in_progress')
    const width = Math.max(10, Math.min(30, e.props.bodyColumns - 16))
    const total = list.reduce((sum, one) => sum + one.usd, 0)
    const endOf = (one: Helper) => (one.status === 'running' ? now : (one.endedAt ?? now))
    const first = Math.min(...list.map(one => one.startedAt))
    const last = Math.max(...list.map(endOf))
    const running = list.filter(one => one.status === 'running').length

    return (
      <Box flexDirection="column">
        {steps.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            <Text>
              <Text color="success">{bar(done, steps.length, width)}</Text> {done} of {steps.length} done
            </Text>
            {current && (
              <Text dimColor wrap="truncate-end">
                Now: {current.content}
              </Text>
            )}
          </Box>
        )}
        {list.length === 0 && <Text dimColor>No helpers yet. When Claude sends some off, they show up here.</Text>}
        {list.map(one => (
          <Box key={one.id} flexDirection="column" marginBottom={1}>
            <Text wrap="truncate-end">
              {one.glyph} {one.description}
            </Text>
            <Text dimColor={one.status !== 'running'} color={one.status === 'failed' ? 'error' : undefined}>
              {'   '}
              {one.status} {duration(endOf(one) - one.startedAt)}
              {one.tokens > 0 ? ` · ${count(one.tokens)} tokens · ≈ ${money(one.usd)}` : ''}
            </Text>
          </Box>
        ))}
        {list.length > 0 && (
          <Text bold>
            Whole job: {list.length} {list.length === 1 ? 'helper' : 'helpers'}, ≈ {money(total)} at API prices,{' '}
            {duration(last - first)}
            {running > 0 ? ` (${running} still running)` : ''}
          </Text>
        )}
      </Box>
    )
  })
}
