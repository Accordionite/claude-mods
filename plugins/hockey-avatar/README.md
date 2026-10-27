# hockey-avatar

A hockey rink for Claude Code, drawn in the band above the prompt. Clawd, the pixel Claude Code mascot, skates on it: laps of the ice while Claude works, a shot into the net with a goal lamp and a "GOAL!" toast when a turn finishes, then back to center ice. The rink has a net at each end and the Accordion emblem at center ice.

## Commands

- `/rink` shows the score (goals = finished turns, shots = tool calls)
- `/rink hide` hides the band
- `/rink show` brings the band back
- `/rink reset` starts a new game: goals and shots back to 0

## Install

Install it from the `Accordionite/claude-mods` marketplace: in the Claude desktop app, click **+** next to the prompt box, then **Plugins**, then **Add marketplace** with `Accordionite/claude-mods`, then **Add plugin** and choose **hockey-avatar**. Or, at the prompt of a terminal session:

    /plugin install hockey-avatar --marketplace Accordionite/claude-mods

Start a new Code tab session: the rink shows above the prompt and `/rink` replies. A terminal shows a one-line text version; VS Code draws nothing.

## Editing

`hooks/register.tsx` is the mod; `hooks/rink-svg.ts` draws the rink (its size is `W` and `H` there). `tsconfig.json` extends `.claude-plugin/types/tsconfig.json`, which Claude Code writes the first time it loads the mod.
