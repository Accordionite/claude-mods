# Reflect

> **Source.** From Christian Peverelli's WeAreNoCode mod bundle (`wearenocode-claude-mods.zip`, version 0.1.0, built on Claude Code 2.1.308), copied unchanged apart from this note. The bundle came with no license.

Reflect turns your corrections into rules Claude keeps.

When you tell Claude something like "never use em dashes" or "stop asking me so many questions", a bar shows up above the prompt: Save as a rule? Pick where it goes:

- **This project**: `CLAUDE.md` in your project folder
- **All projects**: `~/.claude/CLAUDE.md`
- **Skill: name**: that skill's `SKILL.md`, one button for each skill you have
- **No thanks**

Rules go under a "Rules saved by Reflect" heading, dated. Reflect creates the file or heading if it's missing.

Cost: a free word check runs on every message. Only a message that sounds like a correction gets one small model call (Haiku) to decide if it's a lasting rule.

Type `/reflect` to turn it off, and again to turn it back on. Scheduled tasks and messages starting with `go:` are skipped.
