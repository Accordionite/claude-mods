import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Mood } from '../types'
import { RINK_HEIGHT, RINK_WIDTH, rinkSvg, rinkText } from './rink-svg'

const mood = atom({ plugin: 'hockey-avatar', key: 'mood' } as const, 'idle' as Mood)
const goals = atom({ plugin: 'hockey-avatar', key: 'goals' } as const, 0)
const shots = atom({ plugin: 'hockey-avatar', key: 'shots' } as const, 0)
const isHidden = atom({ plugin: 'hockey-avatar', key: 'isHidden' } as const, false)
// Animation tick for the terminal's text rink; the desktop's SVG animates by itself.
const frame = atom({ plugin: 'hockey-avatar', key: 'frame' } as const, 0)

// How long the goal celebration stays up before the skater skates back to center ice.
const CELEBRATE_MS = 5000
const FRAME_MS = 150
// The rink is drawn at the band's size (735 x 110), so the frame shows it 1:1.
const BAND_WIDTH = RINK_WIDTH
const BAND_HEIGHT = RINK_HEIGHT

const FACE: Record<Mood, string> = {
  idle: '(•ᴗ•)',
  working: '(ò_ó)',
  goal: '(ᵔ◡ᵔ)',
}
const LINE: Record<Mood, string> = {
  idle: 'Warming up at center ice',
  working: 'On a breakaway...',
  goal: 'HE SHOOTS, HE SCORES!',
}

const USAGE = 'Usage: /rink [show | hide | reset]'

// Module state: a reload runs the module again and starts these over.
let celebration: { cancel: () => void } | undefined
let ticker: { cancel: () => void } | undefined
let isSetUp = false

// Only a terminal needs the frame counter; skip the redraws when nothing draws text.
async function startTicker($: EngineInterface) {
  if (ticker || !(await $.session.surfaces()).includes('terminal')) return
  ticker = $.clock.every(FRAME_MS, () => void update($, frame, n => n + 1))
}
function stopTicker() {
  ticker?.cancel()
  ticker = undefined
}

// session.start never fires for a mod first loaded mid-session, so the first draw or prompt registers too.
async function setUp($: EngineInterface) {
  if (isSetUp) return
  isSetUp = true
  await $.command.register({
    name: 'rink',
    description: 'Hockey avatar: show the score; /rink show, /rink hide, /rink reset',
  })
  // A reload drops the module's timer, so don't leave the skater stuck celebrating.
  await update($, mood, m => (m === 'goal' ? 'idle' : m))
  $.ui.status('🏒 hockey-avatar loaded')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await setUp($)
    return next(e)
  })

  on('command.run', { command: 'rink' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()

    if (arg === 'show') {
      await update($, isHidden, () => false)
      return { text: '🏒 Back on the ice.' }
    }
    if (arg === 'hide') {
      await update($, isHidden, () => true)
      return { text: '🏒 Band hidden. /rink show brings it back.' }
    }
    if (arg === 'reset') {
      celebration?.cancel()
      stopTicker()
      await update($, goals, () => 0)
      await update($, shots, () => 0)
      await update($, mood, () => 'idle')
      return { text: '🏒 New game: Goals 0  Shots 0' }
    }
    if (arg !== '') return { text: USAGE }

    const surfaces = await $.session.surfaces()
    const m = await read($, mood)
    const g = await read($, goals)
    const s = await read($, shots)
    const hidden = (await read($, isHidden)) ? ' (band hidden: /rink show)' : ''
    return {
      text: `🏒 ${FACE[m]}🥅 ${LINE[m]}${hidden}\nGoals: ${g}  Shots: ${s}\nSurfaces drawing this session: ${surfaces.join(', ') || 'none'}\n${USAGE}`,
    }
  })

  on('prompt.submit', async ($, e, next) => {
    await setUp($)
    celebration?.cancel()
    await update($, mood, () => 'working')
    await startTicker($)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    await update($, shots, n => n + 1)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await update($, mood, () => 'goal')
    await update($, goals, n => n + 1)
    $.ui.toast('🚨 GOAL!')

    celebration?.cancel()
    celebration = $.clock.after(CELEBRATE_MS, () => {
      // Only settle back if a new turn hasn't already started.
      void (async () => {
        await update($, mood, m => (m === 'goal' ? 'idle' : m))
        if ((await read($, mood)) === 'idle') stopTicker()
      })()
    })
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    await setUp($)
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)

    const m = await read($, mood)
    const elements = $.ui.resolve(e)

    const { Box, Text } = elements

    // Just the rink, centered; an explicit size keeps the frame exactly as tall as the drawing.
    if ('Svg' in elements) {
      const { Svg } = elements
      return (
        <Box justifyContent="center">
          <Svg
            source={rinkSvg(m)}
            alt={`Hockey rink: ${LINE[m]}`}
            width={BAND_WIDTH}
            height={BAND_HEIGHT}
            isInteractive
          />
        </Box>
      )
    }

    // The terminal has no Svg: a text lane redrawn on each frame tick.
    const f = m === 'idle' ? 0 : await read($, frame)
    return (
      <Box justifyContent="center">
        <Text>{rinkText(m, f, e.props.bodyColumns)}</Text>
      </Box>
    )
  })
}
