# Copilot Instructions

## Build & Test

```sh
trunk build               # Compile Rust → WASM, outputs to dist/
trunk serve --port 8765   # Dev server with hot reload at http://localhost:8765
cargo clippy --target wasm32-unknown-unknown -- -D warnings   # Lint
npm test                  # Playwright e2e tests (auto-starts trunk serve on :8765)
npx playwright test -g "test name"   # Run a single test by title
npx playwright test --headed         # Run tests with visible browser
```

CI runs clippy → build → test on every push/PR to `main` (Node 22, Chromium only).

## Architecture

Interactive CLI-style terminal portfolio compiled to WebAssembly with Rust. The visitor types commands in a terminal and sees streaming output that mimics LLM token-by-token rendering.

**Tech stack:** Rust 1.94+, `wasm-bindgen` + `web-sys` (raw DOM, no framework), `trunk` (build/serve), `serde`/`serde_json` (content deserialization).

**Module structure** (`src/`):
- `lib.rs` — WASM entry point (`#[wasm_bindgen(start)]`), declares all modules, calls `terminal::init()`
- `terminal.rs` — orchestrates init, keydown handler, history, tab autocomplete, fuzzy matching, command execution
- `streaming.rs` — hand-rolled markup tokenizer + async typewriter streaming engine with jitter
- `commands.rs` — `CommandRegistry` (insertion-order tracking), `CommandResult` enum, 7 visible command handlers
- `easter_eggs.rs` — 12 hidden commands registered into the registry
- `content.rs` — serde structs matching `data/content.json`, async fetch with `thread_local` `Rc` cache
- `utils.rs` — `levenshtein()` fuzzy matching (O(n) two-row DP), `escape_html()`
- `matrix.rs` — canvas-based Matrix rain effect using `Rc<RefCell<Vec<f64>>>` shared state

**Command system:** Commands are registered via `CommandRegistry::register(name, description, hidden)`. Execution returns a `CommandResult` enum:
- `Output(String)` — streamed to the terminal with markup rendering
- `Silent` — command handled its own output (e.g., `clear` wipes the terminal)
- `MatrixSignal` — triggers the matrix rain easter egg

Hidden commands (`hidden = true`) are easter eggs that don't appear in `help` output. See `src/easter_eggs.rs`.

**State management:** `thread_local! + RefCell` for global state (single-threaded WASM). Event handlers use `Closure::wrap + .forget()` pattern. Async operations use `wasm_bindgen_futures::spawn_local()`.

**Content is data-driven:** All portfolio text (bio, projects, skills, contact) lives in `data/content.json`, loaded at runtime via `fetch` and cached in a `thread_local` `Rc`. Commands format this data into markup strings.

**Streaming markup:** `streaming::parse_markup` supports: `**bold**`, `` `code` ``, `[text](url)`, `## headers`, and `---` separators. Command output should use only these. URLs in links must use `https://`, `http://`, `mailto:`, or `#` schemes (others are rejected for security).

## Conventions

- CSS custom properties in `:root` for theming (`--bg`, `--accent`, `--text`, etc.) — use these, don't hardcode colors
- Tests use a `runCommand(page, cmd)` helper that types a command and waits for streaming to finish
- Multi-word commands (like `hire me`) are handled by special-case parsing in `terminal.rs`
- `js/` directory still exists on disk but is not loaded — it can be deleted safely
