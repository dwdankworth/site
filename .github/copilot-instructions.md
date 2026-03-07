# Copilot Instructions

## Build & Test

No build step — this is a static site served directly from the repo root.

```sh
npm run lint              # ESLint on js/ and tests/
npm test                  # Playwright e2e tests (auto-starts local server on :8765)
npx playwright test -g "test name"   # Run a single test by title
npx playwright test --headed         # Run tests with visible browser
```

CI runs lint → test on every push/PR to `main` (Node 22, Chromium only).

## Architecture

Interactive CLI-style terminal portfolio. The visitor types commands in a fake terminal and sees streaming output that mimics LLM token-by-token rendering.

**Module pattern:** All browser JS uses IIFEs that expose globals (`Commands`, `StreamingEngine`, `Terminal`) — no bundler, no ES modules. Script load order in `index.html` matters: `streaming.js` → `commands.js` → `easter-eggs.js` → `terminal.js`.

**Command system:** Commands are registered via `Commands.register(name, handler, description, hidden)`. The handler is an async function that returns:
- A **string** — streamed to the terminal with markup rendering
- **`null`** — command handled its own output (e.g., `clear`)
- **`'__MATRIX__'`** — triggers the matrix rain easter egg

Hidden commands (`hidden = true`) are easter eggs that don't appear in `help` output. See `js/easter-eggs.js`.

**Content is data-driven:** All portfolio text (bio, projects, skills, contact) lives in `data/content.json`, loaded at runtime via `fetch`. Commands format this data into markup strings.

**Streaming markup:** The `StreamingEngine` supports a limited markup set: `**bold**`, `` `code` ``, `[text](url)`, `## headers`, and `---` separators. Command output should use only these.

## Conventions

- CSS custom properties in `:root` for theming (`--bg`, `--accent`, `--text`, etc.) — use these, don't hardcode colors
- ESLint treats `js/` as `sourceType: "script"` (browser globals) and `tests/` as `sourceType: "module"`
- Tests use a `runCommand(page, cmd)` helper that types a command and waits for streaming to finish
- Multi-word commands (like `hire me`) are handled by special-case parsing in `terminal.js`
