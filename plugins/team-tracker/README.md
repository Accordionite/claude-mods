# Team Tracker

> **Source.** From Christian Peverelli's WeAreNoCode mod bundle (`wearenocode-claude-mods.zip`, version 0.1.0, built on Claude Code 2.1.308), copied unchanged apart from this note. The bundle came with no license.
>
> Install: `claude plugin install team-tracker --marketplace Accordionite/claude-mods`

A pane called Team that shows the job Claude is working on. At the top, a progress bar for the to-do list ("4 of 7 done") and the step it is on now. Below it, every helper Claude sends off, each with its own little character, what it is working on, whether it is still running, how long it has run, and its tokens with a rough cost at API prices (on a Max plan the plan covers it). A total line sums up the whole job.

Type `/team` to open it. In a wide window that docks panes it opens by itself when the first helper of a job starts. While helpers run, the status line says how many are running and done. It only watches and draws, so it costs nothing.
