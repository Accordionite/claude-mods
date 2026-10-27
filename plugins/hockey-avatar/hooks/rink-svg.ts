import type { Mood } from '../types'

// The animated rink drawn on the desktop app: SMIL animation inside one SVG, no timers.
// The skater is drawn around its feet at (0, 0), facing right.

// Drawn at the band's own size, so the band shows it 1:1 with nothing squashed.
// The layout was designed 640 wide: x() spreads a position across the wider ice, and the net
// end shifts right by NET_SHIFT so it keeps its distance from the boards. Clawd keeps his size.
const W = 735
const H = 110
const x = (n: number) => Math.round((n * W) / 640)
const NET_SHIFT = W - 640
export const RINK_WIDTH = W
export const RINK_HEIGHT = H
const CLAY = '#D97757'
const INK = '#2B2B2B'

// One net end, drawn at the right; the left end is the same mirrored.
const netEnd = `
  <line x1="590" y1="10" x2="590" y2="${H - 10}" stroke="#E05A5A" stroke-width="2" opacity="0.6"/>
  <path d="M590 40 A16 16 0 0 0 590 72" fill="#BFE0F5" stroke="#E05A5A" stroke-width="2"/>
  <g stroke="#E05A5A" stroke-width="2" fill="none">
    <rect x="590" y="40" width="22" height="32"/>
  </g>
  <g stroke="#B0B0B0" stroke-width="1">
    <line x1="595" y1="40" x2="595" y2="72"/><line x1="600" y1="40" x2="600" y2="72"/>
    <line x1="605" y1="40" x2="605" y2="72"/><line x1="610" y1="40" x2="610" y2="72"/>
    <line x1="590" y1="48" x2="612" y2="48"/><line x1="590" y1="56" x2="612" y2="56"/>
    <line x1="590" y1="64" x2="612" y2="64"/>
  </g>`

// The Accordion emblem at center ice: the yellow disc with its dark A, on a white rim
// where the original has black. Traced on a 500 x 500 square, scaled into the center circle.
const EMBLEM_R = 19
const emblem = `
  <circle cx="${W / 2}" cy="${H / 2}" r="${EMBLEM_R + 2}" fill="#FFFFFF"/>
  <g transform="translate(${W / 2 - EMBLEM_R} ${H / 2 - EMBLEM_R}) scale(${(EMBLEM_R * 2) / 500})">
    <circle cx="250" cy="250" r="250" fill="#EEF68A"/>
    <g fill="#1F2430">
      <polygon points="121,362 205,157 228,218 172,362"/>
      <polygon points="226,103 276,103 378,362 213,362 232,318 308,318"/>
    </g>
  </g>`

const rink = `
  <rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="42" fill="#EEF6FC" stroke="#9DB8CC" stroke-width="3"/>
  <line x1="${W / 2}" y1="4" x2="${W / 2}" y2="${H - 4}" stroke="#E05A5A" stroke-width="4" opacity="0.7"/>
  <line x1="${x(213)}" y1="4" x2="${x(213)}" y2="${H - 4}" stroke="#4A7FD1" stroke-width="4" opacity="0.6"/>
  <line x1="${x(427)}" y1="4" x2="${x(427)}" y2="${H - 4}" stroke="#4A7FD1" stroke-width="4" opacity="0.6"/>
  <circle cx="${W / 2}" cy="${H / 2}" r="22" fill="none" stroke="#4A7FD1" stroke-width="2" opacity="0.5"/>
  ${emblem}
  <g transform="translate(${NET_SHIFT} 0)">${netEnd}</g>
  <g transform="translate(${W} 0) scale(-1 1)"><g transform="translate(${NET_SHIFT} 0)">${netEnd}</g></g>`

// Clawd's eyes: tall pixel squares, squinted while working, happy ^ ^ after a goal.
const pixelSmile = (x: number) =>
  `<rect x="${x}" y="-24" width="1.5" height="1.5"/><rect x="${x + 1.5}" y="-25.5" width="1.5" height="1.5"/><rect x="${x + 3}" y="-24" width="1.5" height="1.5"/>`
const face: Record<Mood, string> = {
  idle: `<g fill="${INK}"><rect x="-7" y="-26" width="3" height="5"/><rect x="4" y="-26" width="3" height="5"/></g>`,
  working: `<g fill="${INK}"><rect x="-7" y="-24" width="3" height="3"/><rect x="4" y="-24" width="3" height="3"/></g>`,
  goal: `<g fill="${INK}">${pixelSmile(-7.5)}${pixelSmile(3.5)}</g>`,
}

// Clawd, the Claude Code mascot, in pixels: blocky body, side nubs, four little legs in skates.
// The stick is drawn separately so it can move on its own.
function skater(mood: Mood, stick: string): string {
  return `
    <ellipse cx="0" cy="1" rx="16" ry="2.5" fill="#000" opacity="0.12"/>
    <g shape-rendering="crispEdges">
      <g fill="${CLAY}">
        <rect x="-12" y="-30" width="24" height="21"/>
        <rect x="-15" y="-21" width="3" height="6"/>
        <rect x="12" y="-21" width="3" height="6"/>
        <rect x="-11" y="-9" width="3" height="6"/><rect x="-6" y="-9" width="3" height="6"/>
        <rect x="3" y="-9" width="3" height="6"/><rect x="8" y="-9" width="3" height="6"/>
      </g>
      <g fill="${INK}">
        <rect x="-12" y="-4" width="10" height="2.5"/><rect x="2" y="-4" width="10" height="2.5"/>
      </g>
      ${face[mood]}
    </g>
    <line x1="-13" y1="0" x2="-1" y2="0" stroke="#8A8A8A" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="1" y1="0" x2="13" y2="0" stroke="#8A8A8A" stroke-width="1.5" stroke-linecap="round"/>
    ${stick}`
}

const stickLine = (extra = '') => `
  <g>
    <line x1="14" y1="-18" x2="24" y2="-1" stroke="#7A4E2D" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="24" y1="-1" x2="32" y2="-1" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    ${extra}
  </g>`

// Stickhandling: the stick sweeps a little and the puck slides with it.
const dribble = (dur: string) =>
  stickLine(`<animateTransform attributeName="transform" type="rotate" values="-8 14 -18;8 14 -18;-8 14 -18" dur="${dur}" repeatCount="indefinite"/>`) +
  `<ellipse cx="35" cy="0" rx="4" ry="1.8" fill="${INK}">
     <animate attributeName="cx" values="33;39;33" dur="${dur}" repeatCount="indefinite"/>
   </ellipse>`

// A skating stride: a small rock side to side.
const stride = (dur: string, deg: number) =>
  `<animateTransform attributeName="transform" type="rotate" values="-${deg} 0 0;${deg} 0 0;-${deg} 0 0" dur="${dur}" repeatCount="indefinite"/>`

const idleScene = `
  <g>
    <animateTransform attributeName="transform" type="translate"
      values="${x(290)} 86;${x(350)} 80;${x(310)} 90;${x(270)} 82;${x(290)} 86" dur="7s" repeatCount="indefinite"/>
    <g>${stride('1.6s', 3)}${skater('idle', dribble('1.2s'))}</g>
  </g>`

// Laps of the ice: out to the right along one lane, back along another, flipping to face the way it skates.
const workingScene = `
  <g>
    <animateTransform attributeName="transform" type="translate"
      values="${x(70)} 84;${x(220)} 66;${x(400)} 92;${x(555)} 76;${x(400)} 64;${x(220)} 94;${x(70)} 84"
      keyTimes="0;0.17;0.33;0.5;0.67;0.83;1" dur="5s" repeatCount="indefinite"/>
    <g>
      <animateTransform attributeName="transform" type="scale" values="1 1;-1 1"
        keyTimes="0;0.5" calcMode="discrete" dur="5s" repeatCount="indefinite"/>
      <g>${stride('0.5s', 7)}${skater('working', dribble('0.4s'))}</g>
    </g>
  </g>
  <g fill="#BFD7E8" opacity="0.8">
    <circle r="2"><animateMotion path="M${x(70)} 86 L${x(220)} 68 L${x(400)} 94 L${x(555)} 78 L${x(400)} 66 L${x(220)} 96 L${x(70)} 86" dur="5s" begin="-0.15s" repeatCount="indefinite"/></circle>
    <circle r="1.5"><animateMotion path="M${x(70)} 86 L${x(220)} 68 L${x(400)} 94 L${x(555)} 78 L${x(400)} 66 L${x(220)} 96 L${x(70)} 86" dur="5s" begin="-0.3s" repeatCount="indefinite"/></circle>
  </g>`

// One shot: wind up, puck into the net, lamp flashes, then the skater jumps with the stick raised.
const goalScene = `
  <g transform="translate(${NET_SHIFT} 0)">
  <g transform="translate(470 84)">
    <g>
      <animateTransform attributeName="transform" type="translate"
        values="0 0;0 0;0 -10;0 0;0 -10;0 0" keyTimes="0;0.35;0.5;0.65;0.8;1" dur="2.2s" fill="freeze"/>
      ${skater('goal', stickLine(`
        <animateTransform attributeName="transform" type="rotate"
          values="0 14 -18;-55 14 -18;25 14 -18;25 14 -18;-150 14 -18"
          keyTimes="0;0.15;0.25;0.35;0.5" dur="2.2s" fill="freeze"/>`))}
    </g>
  </g>
  <ellipse cx="505" cy="84" rx="4" ry="1.8" fill="${INK}">
    <animateMotion path="M0 0 Q46 -14 99 -26" keyTimes="0;1" keySplines="0.2 0 0.4 1" calcMode="spline"
      begin="0.5s" dur="0.35s" fill="freeze"/>
  </ellipse>
  <circle cx="601" cy="22" r="8" fill="#5A1A1A">
    <animate attributeName="fill" values="#5A1A1A;#FF3B30;#5A1A1A" dur="0.4s" begin="0.85s" repeatCount="8"/>
  </circle>
  <rect x="596" y="29" width="10" height="5" fill="#666"/>
  </g>
  <text x="${W / 2}" y="40" font-size="26" font-family="sans-serif" font-weight="900"
    fill="#E05A5A" text-anchor="middle" opacity="0">GOAL!
    <animate attributeName="opacity" values="0;1;1;0.85" keyTimes="0;0.2;0.8;1" begin="0.85s" dur="1.6s" fill="freeze"/>
  </text>`

const scene: Record<Mood, string> = { idle: idleScene, working: workingScene, goal: goalScene }

export function rinkSvg(mood: Mood): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="display:block;width:100%;max-width:${W}px;height:auto">${rink}${scene[mood]}</svg>`
}

// The terminal's version: one text lane, redrawn from a frame counter.
export function rinkText(mood: Mood, frame: number, columns: number): string {
  const lane = Math.max(16, Math.min(columns - 30, 60))
  const cells = Array<string>(lane).fill(' ')

  if (mood === 'working') {
    const span = lane - 3
    const step = frame % (span * 2)
    const goingRight = step < span
    const x = 2 + (goingRight ? step : span * 2 - step) - 1
    cells[x] = '⛸'
    cells[goingRight ? x + 2 : x - 2] = '•'
  } else if (mood === 'goal') {
    cells[lane - 6] = '⛸'
    cells[lane - 1] = '•'
  } else {
    const x = Math.floor(lane / 2) + (Math.floor(frame / 3) % 3) - 1
    cells[x] = '⛸'
    cells[x + 2] = '•'
  }
  return `|${cells.join('')}|🥅`
}
