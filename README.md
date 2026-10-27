# claude-mods

Claude Code mods made at Accordion. This repository is a plugin marketplace: add it once, then install any mod in it.

| Mod | What it does |
| --- | --- |
| [hockey-avatar](plugins/hockey-avatar) | Clawd plays hockey on a rink above the prompt, with the Accordion emblem at center ice. `/rink` shows the score. |
| [token-ledger](plugins/token-ledger) | A status line under the prompt with the session cost, the last turn's tokens and the cache hit ratio. `/ledger` shows a table of recent turns. From [Arunjay4213/claude-mods](https://github.com/Arunjay4213/claude-mods). |
| [blast-radius-win](plugins/blast-radius-win) | Holds a risky shell command (`rm -rf`, `git reset --hard`, force push, migrations) and shows what it would change, with **Proceed** and **Cancel** buttons. Anthropic's [blast-radius](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods/blast-radius), patched to run on Windows. |

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
