import { atom, read, update } from 'claude-code'
import type { EngineInterface, PromptSubmitInput, Register } from 'claude-code'

import type { Pending, Place } from '../types'

const PENDING = { plugin: 'reflect', key: 'pending' } as const
const pending = atom(PENDING, null)

const STALE_MS = 30 * 60 * 1000
export const HEADING = '## Rules saved by Reflect'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Free first: only a prompt that sounds like a correction reaches the model.
const HINT =
  /\b(never|always|stop|don'?t|do not|from now on|every time|each time|i told you|again|wrong|bad job|instead|should be|i prefer|prefer|kill|no more|quit|remember|not like that|too (long|short|much|many))\b/i

// The place the model suggests, before it is matched to a file.
export type Suggested = { kind: 'project' } | { kind: 'everywhere' } | { kind: 'skill'; skill: string }
export type Found = { rule: string; place: Suggested }

export function isPersonPrompt(e: Pick<PromptSubmitInput, 'text' | 'command' | 'isMeta' | 'origin'>): boolean {
  if (e.command !== undefined || e.isMeta === true) return false
  // Another mod that resends the person's own words (asUser) counts as the person.
  const isTheirs =
    e.origin.kind === 'composer' || e.origin.kind === 'bridge' || (e.origin.kind === 'plugin' && e.origin.asUser === true)
  if (!isTheirs) return false

  return !/^\s*go:/i.test(e.text)
}

export function hasRuleHint(text: string): boolean {
  return HINT.test(text)
}

function system(skills: readonly string[]): string {
  const list = skills.length > 0 ? skills.join(', ') : '(none)'

  return `You catch lasting rules in what the person types to Claude.
A rule is a lasting preference or correction about how Claude should work or write from now on ("never use em dashes", "stop asking me so many questions", "always run the tests before you say it works"). A one-off instruction for the task at hand is not a rule ("make this line shorter", "don't touch that file today", "stop the build").
Reply with JSON only, no prose:
{"isRule": true or false, "rule": "...", "place": "project" or "everywhere" or "skill", "skill": "..." or null}
rule: one line, an instruction to Claude, keep the person's own words where you can, no dashes.
place: "project" when it is about this project (its code, files, content, tools or way of working); "everywhere" when it is a personal preference for how Claude should work or write in any project; "skill" when it belongs to one of these skills: ${list} (put its exact name in "skill").`
}

// The model's JSON, checked: null unless it is a rule. An unknown place or skill falls back to the project.
export function parseFound(raw: string, skills: readonly string[]): Found | null {
  const match = /\{[\s\S]*\}/.exec(raw)
  if (match === null) return null
  let data: unknown
  try {
    data = JSON.parse(match[0])
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null) return null
  const found = data as Record<string, unknown>
  if (found.isRule !== true || typeof found.rule !== 'string') return null
  const rule = tidy(found.rule)
  if (rule === '') return null
  const skill = typeof found.skill === 'string' ? found.skill.trim() : ''
  const place: Suggested =
    found.place === 'everywhere'
      ? { kind: 'everywhere' }
      : found.place === 'skill' && skills.includes(skill)
        ? { kind: 'skill', skill }
        : { kind: 'project' }

  return { rule, place }
}

function tidy(text: string): string {
  return text
    .trim()
    .replace(/^["'“]+|["'”]+$/g, '')
    .replace(/\s*[\u2014\u2013]\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function placeKey(place: Place): string {
  return place.kind === 'skill' ? `skill-${place.skill}` : place.kind
}

export function placeLabel(place: Place): string {
  return place.kind === 'project' ? 'This project' : place.kind === 'everywhere' ? 'All projects' : `Skill: ${place.skill}`
}

function placeName(place: Place): string {
  return place.kind === 'project' ? 'this project' : place.kind === 'everywhere' ? 'all projects' : `the ${place.skill} skill`
}

// "Oct 23, 2026" in the machine's own time zone.
export function dayLabel(ms: number): string {
  const date = new Date(ms)
  try {
    const parts = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).formatToParts(date)
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
    const month = get('month')
    const day = get('day')
    const year = get('year')
    if (month !== '' && day !== '' && year !== '') return `${month} ${day}, ${year}`
  } catch {
    // No Intl here: the Date's local getters below.
  }

  return `${MONTHS[date.getMonth()] ?? ''} ${date.getDate()}, ${date.getFullYear()}`
}

function present(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value.replace(/[\\/]+$/, '')
}

// The folder Claude Code keeps its own files in: ~/.claude, or CLAUDE_CONFIG_DIR when set.
async function configDir($: EngineInterface): Promise<string | undefined> {
  const custom = present(await $.env.get('CLAUDE_CONFIG_DIR'))
  if (custom !== undefined) return custom
  const home = present(await $.env.get('HOME')) ?? present(await $.env.get('USERPROFILE'))

  return home === undefined ? undefined : `${home}/.claude`
}

// Adds each <dir>/<name>/SKILL.md to `into`, keeping a name already there.
async function skillsIn($: EngineInterface, dir: string, into: Map<string, string>): Promise<void> {
  let entries: Awaited<ReturnType<EngineInterface['fs']['list']>>
  try {
    entries = await $.fs.list(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || into.has(entry.name)) continue
    const path = `${dir}/${entry.name}/SKILL.md`
    if (await $.fs.exists(path).catch(() => false)) into.set(entry.name, path)
  }
}

type Where = { project: string; everywhere: string | undefined; skills: [string, string][] }

// Every place a rule can go, read now.
async function where($: EngineInterface): Promise<Where> {
  const root = (await $.session.root()).replace(/[\\/]+$/, '')
  const config = await configDir($)
  const found = new Map<string, string>()
  // The project's skills first: a project skill wins over a personal one of the same name.
  await skillsIn($, `${root}/.claude/skills`, found)
  if (config !== undefined) await skillsIn($, `${config}/skills`, found)
  const skills = [...found].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))

  return { project: `${root}/CLAUDE.md`, everywhere: config === undefined ? undefined : `${config}/CLAUDE.md`, skills }
}

// The suggested place first, then the others in their usual order.
function placesFor(found: Found, at: Where): Place[] {
  const all: Place[] = [{ kind: 'project', path: at.project }]
  if (at.everywhere !== undefined) all.push({ kind: 'everywhere', path: at.everywhere })
  for (const [skill, path] of at.skills) all.push({ kind: 'skill', skill, path })
  const suggested = found.place
  const first = all.findIndex(
    p => p.kind === suggested.kind && (p.kind !== 'skill' || (suggested.kind === 'skill' && p.skill === suggested.skill)),
  )
  if (first > 0) {
    const [chosen] = all.splice(first, 1)
    if (chosen !== undefined) all.unshift(chosen)
  }

  return all
}

function isSectionEnd(line: string): boolean {
  return /^#{1,2}\s/.test(line)
}

// Adds `line` to the end of the Reflect section, making the section (and the file) when missing.
export function withRule(text: string, line: string): { text: string; count: number } {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const body = text.replace(/\s+$/, '')
  const lines = body === '' ? [] : body.split(/\r?\n/)
  let start = lines.findIndex(l => l.trim() === HEADING)
  if (start < 0) {
    if (lines.length > 0) lines.push('')
    lines.push(HEADING)
    start = lines.length - 1
  }
  let end = start + 1
  while (end < lines.length && !isSectionEnd(lines[end] ?? '')) end += 1
  let last = end - 1
  while (last > start && (lines[last] ?? '').trim() === '') last -= 1
  if (last === start) lines.splice(start + 1, 0, '', line)
  else lines.splice(last + 1, 0, line)

  let count = 0
  for (let i = start + 1; i < lines.length && !isSectionEnd(lines[i] ?? ''); i += 1) {
    if ((lines[i] ?? '').startsWith('- ')) count += 1
  }

  return { text: `${lines.join(eol)}${eol}`, count }
}

// Writes the rule where the person picked; answers what the toast says.
async function save($: EngineInterface, rule: Pending, place: Place): Promise<string> {
  const text = (await $.fs.exists(place.path)) ? await $.fs.read(place.path) : ''
  const next = withRule(text, `- ${rule.rule.replace(/\.$/, '')} (saved ${dayLabel(await $.clock.now())})`)
  await $.fs.write(place.path, next.text)

  return `Saved to ${placeName(place)}. ${next.count} ${next.count === 1 ? 'rule' : 'rules'} there now.`
}

async function isOn($: EngineInterface): Promise<boolean> {
  return (await $.store.get('enabled')) !== false
}

async function dropStale($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  await update($, pending, current => (current !== null && now - current.at > STALE_MS ? null : current))
}

async function catchRule($: EngineInterface, said: string): Promise<void> {
  if (!(await isOn($))) return
  const at = await where($)
  const skills = at.skills.map(([name]) => name)
  const reply = await $.model.complete({
    model: 'haiku',
    system: system(skills),
    prompt: `What the person typed:\n\n${said.slice(0, 4000)}`,
    effort: 'low',
    maxTokens: 200,
    timeoutMs: 20000,
  })
  if (!reply.isAnswered) return
  const found = parseFound(reply.text, skills)
  if (found === null) return
  const next: Pending = { rule: found.rule, places: placesFor(found, at), at: await $.clock.now() }
  await update($, pending, () => next)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'reflect',
      description: 'Turn Reflect on or off (it offers to save your corrections as permanent rules)',
      argumentHint: '[on|off]',
    })

    return next(e)
  })

  on('command.run', { command: 'reflect' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const turnOn = arg === 'on' ? true : arg === 'off' ? false : !(await isOn($))
    await $.store.set('enabled', turnOn)
    if (!turnOn) await update($, pending, () => null)

    return {
      text: turnOn
        ? 'Reflect is on. When you correct me, I offer to save it as a permanent rule.'
        : 'Reflect is off. Type /reflect to turn it back on.',
    }
  })

  // The prompt goes through untouched at once; the check runs after it.
  on('prompt.submit', ($, e, next) => {
    if (isPersonPrompt(e)) {
      const said = e.text
      const isHint = hasRuleHint(said)
      $.clock.after(0, () => {
        void dropStale($)
          .then(() => (isHint ? catchRule($, said) : undefined))
          .catch(() => undefined)
      })
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey) return below
    const current = await read($, pending)
    if (current === null) return below
    const { Box, Button, Text } = $.ui.resolve(e)

    const pick = async (place: Place) => {
      const { value } = await $.state.get(PENDING)
      if (value === undefined || value === null) return
      await update($, pending, () => null)
      try {
        $.ui.toast(await save($, value, place))
      } catch {
        await update($, pending, () => value)
        $.ui.toast("Couldn't save that rule. Try again, or ask Claude to add it.")
      }
    }

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Text bold color="suggestion">
            Save as a rule?
          </Text>
          <Text wrap="wrap">"{current.rule}"</Text>
        </Box>
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {current.places.map((place, i) => (
            <Button
              key={`reflect-${placeKey(place)}`}
              label={placeLabel(place)}
              variant={i === 0 ? 'primary' : 'secondary'}
              onPress={() => void pick(place)}
            />
          ))}
          <Button key="reflect-no" label="No thanks" onPress={() => void update($, pending, () => null)} />
        </Box>
        {below}
      </Box>
    )
  })
}
