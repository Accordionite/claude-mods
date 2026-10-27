# claude-mods

Claude Code mods made at Accordion. This repository is a plugin marketplace: add it once, then install any mod in it.

| Mod | What it does |
| --- | --- |
| [hockey-avatar](plugins/hockey-avatar) | Clawd plays hockey on a rink above the prompt, with the Accordion emblem at center ice. `/rink` shows the score. |
| [token-ledger](plugins/token-ledger) | A status line under the prompt with the session cost, the last turn's tokens and the cache hit ratio. `/ledger` shows a table of recent turns. From [Arunjay4213/claude-mods](https://github.com/Arunjay4213/claude-mods). |
| [blast-radius-win](plugins/blast-radius-win) | Holds a risky shell command (`rm -rf`, `git reset --hard`, force push, migrations) and shows what it would change, with **Proceed** and **Cancel** buttons. Anthropic's [blast-radius](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods/blast-radius), patched to run on Windows. |
| [handoff](plugins/handoff) | `/handoff` (or its offer when the chat is 60% full) writes a note on what's done, what's next and which files matter to `.claude/handoffs/`, then starts a fresh chat from it. From WeAreNoCode. |
| [team-tracker](plugins/team-tracker) | `/team` opens a pane with a progress bar for the to-do list and every helper agent Claude sends off: what it's on, how long it has run and a rough cost. From WeAreNoCode. |
| [reflect](plugins/reflect) | When you correct Claude, offers to save the correction as a rule in the project's or your CLAUDE.md, or in a skill. Writes only when you press Save. From WeAreNoCode. |
| [brain-dump](plugins/brain-dump) | Holds a long message (about 120 words or more), sorts it into goal, facts and asks, asks up to three questions, then sends the clean version. Start a message with `go:` to skip it. From WeAreNoCode. |

## Install

The repository is private: you need read access to it on GitHub, and GitHub set up on your computer (GitHub Desktop, or `gh auth login` then `gh auth setup-git`).

In the Claude desktop app: click **+** next to the prompt box, then **Plugins**, then **Add marketplace** with `Accordionite/claude-mods`, then **Add plugin** and choose **hockey-avatar**. Start a new Code tab session.

At the prompt of a terminal session:

```
/plugin install hockey-avatar --marketplace Accordionite/claude-mods
```

From a shell:

```
claude plugin install hockey-avatar --marketplace Accordionite/claude-mods
```

If you installed hockey-avatar from a zip or folder before, remove that copy and its marketplace first (+ > Plugins), then install from here.

## Adding a mod

Put it in `plugins/<mod-name>/` and add an entry for it to `.claude-plugin/marketplace.json`. Bump `version` in a mod's `plugin.json` whenever you change it, so installs pick up the change.
