# pi-lumen

Pi extension for interactive [Lumen](https://github.com/jnsahaj/lumen) diff review. Run `/lumen` to choose a recent open GitHub pull request, or pass Lumen `diff` arguments directly. Exported Lumen annotations are prefilled into Pi's editor.

## Prerequisites

- [Pi](https://github.com/badlogic/pi-mono)
- [Lumen](https://github.com/jnsahaj/lumen), installed and available on `PATH`
- [GitHub CLI](https://cli.github.com/) (`gh`), installed and authenticated for the PR picker

```sh
brew install jnsahaj/lumen/lumen
brew install gh

gh auth login
```

Cargo users can install Lumen with `cargo install lumen`.

## Install

```sh
pi install npm:pi-lumen
```

Try it for one run:

```sh
pi -e npm:pi-lumen
```

For local development:

```sh
pi -e /path/to/pi-lumen
```

## Usage

From a GitHub repository in Pi's interactive TUI:

```text
/lumen
```

With no arguments, `/lumen` lists up to 20 recent open pull requests from the current repository. Select one to open it in Lumen.

Explicit arguments bypass the picker and are passed to `lumen diff`:

```text
/lumen HEAD~1
/lumen main..feature
/lumen --pr 123
/lumen --detect-pr
/lumen --file src/main.rs --file src/lib.rs
/lumen --watch
/lumen main..feature --stacked
/lumen --focus src/main.rs
/lumen --theme dracula
/lumen --wrap
```

You may include `diff` explicitly; it is not duplicated:

```text
/lumen diff --detect-pr
```

These options are provided by the installed Lumen version, not implemented independently by this extension.

## Annotation workflow

1. Annotate a selection, hunk, or file in Lumen with `i`.
2. Open annotations with `I`.
3. Press `s`, then confirm with `Enter` to send them to Pi.
4. Pi pre-fills its input editor with the exported annotations.

## Mode support

The PR picker and `lumen diff` are interactive. `/lumen` requires Pi's interactive TUI mode and does not support JSON, print, or other non-interactive workflows.

## Troubleshooting

- **`gh` is missing:** install GitHub CLI and verify with `gh --version`.
- **GitHub authentication fails:** run `gh auth login`, then verify with `gh repo view`.
- **The repository cannot be detected:** run `/lumen` from a GitHub checkout with a configured remote.
- **Lumen is missing:** install it and verify with `command -v lumen` and `lumen --version`.
- **No annotations appear:** create annotations and press `s`, then `Enter`, before closing Lumen.
- **No pull requests appear:** the picker currently lists open pull requests only.

## Development

```sh
bun install
bun run check
```

The check includes typechecking, tests, linting, formatting, and an npm package dry run.
