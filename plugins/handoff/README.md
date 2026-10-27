# Handoff

> **Source.** From Christian Peverelli's WeAreNoCode mod bundle (`wearenocode-claude-mods.zip`, version 0.1.0, built on Claude Code 2.1.308), copied unchanged apart from this note. The bundle came with no license.
>
> Install: `claude plugin install handoff --marketplace Accordionite/claude-mods`

Long chats get slow, pricey and forgetful. Handoff moves your work to a fresh chat without losing the thread.

Type /handoff, or press Hand off on the offer that shows above the prompt once a chat is 60% full. Claude writes a short note: what's done, what's next, what's still unsure, which files matter and what to keep in mind. The note is saved in your project at .claude/handoffs/ and a fresh chat starts from it. If that can't happen on its own, the note is copied for you to paste into a new chat.

Each handoff costs one model call. It works best before a long break, while the chat is still warm.
