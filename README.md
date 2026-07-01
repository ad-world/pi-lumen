# pi-lumen

Pi package for [Lumen](https://github.com/jnsahaj/lumen), focused first on code-review flow:

- `/lumen <identifier>` opens `lumen diff <identifier>` from the current Pi session.
- `/lumen 123`, `/lumen pr 123`, and `/lumen https://github.com/owner/repo/pull/123` normalize to `lumen diff --pr ...`.
- `/lumen` and `/lumen pr` open a picker with previously viewed reviews first, then PRs/ranges mentioned in the chat, then open GitHub PRs from `gh pr list`, then defaults.
- `/lumen detect-pr` opens the PR associated with the current branch via `lumen diff --detect-pr`.
- In Lumen, annotate with `i` / manage annotations with `I`; press `s` to exit and write annotations to stdout. This extension captures that stdout and pre-fills Pi's input editor with the comments so you can review or edit before sending.
- Basic pass-through commands also work: `/lumen explain ...`, `/lumen draft`, `/lumen operate ...`, `/lumen configure`.

## Requirements

- Node-compatible Pi runtime.
- `lumen` on `PATH` (`brew install jnsahaj/lumen/lumen` or `cargo install lumen`).
- `gh` on `PATH` for automatic GitHub PR picker entries.
- A Pi TUI session for the interactive diff viewer.

## Install locally while developing

```bash
pi -e /absolute/path/to/pi-lumen
```

or install as a local package:

```bash
pi install /absolute/path/to/pi-lumen
```

## Publish

```bash
bun pm version patch
bun publish --access public
```

Then install with:

```bash
pi install npm:pi-lumen
```

## Notes

State is stored in `~/.pi/agent/lumen/state.json`, keyed by working directory. Pi session-local review events are also appended as custom `lumen.review` entries.
