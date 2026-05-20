/**
 * Terminal engine — input handling, command dispatch, history, and output rendering.
 */
const Terminal = (() => {
  const output = document.getElementById('terminal-output');
  const input = document.getElementById('terminal-input');
  const ghost = document.getElementById('terminal-ghost');
  const ghostTyped = ghost ? ghost.querySelector('.ghost-typed') : null;
  const ghostTail = ghost ? ghost.querySelector('.ghost-tail') : null;
  const ghostHint = document.getElementById('terminal-hint');
  const chips = document.querySelectorAll('.chip[data-cmd]');

  const HISTORY_KEY = 'danksite:history';
  const HISTORY_CAP = 100;
  const history = loadHistory();
  let historyIdx = -1;
  let isStreaming = false;
  let suppressHashSync = false;

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.slice(0, HISTORY_CAP) : [];
    } catch {
      return [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_CAP)));
    } catch {
      // localStorage may be disabled; ignore
    }
  }

  // === Deep-link helpers ===

  function commandToHash(cmd) {
    const trimmed = cmd.trim();
    if (!trimmed) return '';
    const parts = trimmed.split(/\s+/);
    const name = parts[0].toLowerCase();
    if (name === 'project' && parts[1]) return `#project/${parts[1]}`;
    if (name === 'search' && parts.length > 1) return `#search/${encodeURIComponent(parts.slice(1).join(' '))}`;
    return `#${name}`;
  }

  function hashToCommand(hash) {
    if (!hash || hash === '#') return null;
    const raw = hash.replace(/^#/, '');
    if (!raw) return null;
    const [head, ...rest] = raw.split('/');
    const name = head.toLowerCase();
    if (name === 'project' && rest[0]) return `project ${rest[0]}`;
    if (name === 'search' && rest.length) return `search ${decodeURIComponent(rest.join('/'))}`;
    if (Commands.get(name)) return name;
    return null;
  }

  // Commands that shouldn't change the URL (utilities / ephemeral output)
  const NO_HASH_SYNC = new Set(['clear', 'share', 'help']);

  function updateHash(cmd) {
    if (suppressHashSync) return;
    const name = cmd.trim().split(/\s+/)[0].toLowerCase();
    if (NO_HASH_SYNC.has(name)) return;
    const hash = commandToHash(cmd);
    if (!hash) return;
    if (location.hash === hash) return;
    try {
      history_replaceState(hash);
    } catch {
      // ignore
    }
  }

  // Indirect to avoid shadowing the `history` array with global history
  function history_replaceState(hash) {
    window.history.replaceState(null, '', hash);
  }

  // === Output helpers ===

  function echoCommand(cmd) {
    const line = document.createElement('div');
    line.className = 'output-line command-echo';
    line.innerHTML = `<span class="prompt-echo">visitor@danksite ~ $</span> ${escapeHtml(cmd)}`;
    output.appendChild(line);
    scrollToBottom();
  }

  function addOutputBlock() {
    const block = document.createElement('div');
    block.className = 'output-line';
    output.appendChild(block);
    return block;
  }

  function addBlankLine() {
    output.appendChild(document.createElement('br'));
  }

  function scrollToBottom() {
    output.scrollTop = output.scrollHeight;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // === Matrix rain effect ===

  function matrixRain(duration = 4000) {
    const canvas = document.createElement('canvas');
    canvas.id = 'matrix-canvas';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()';
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops = new Array(columns).fill(1);

    function draw() {
      ctx.fillStyle = 'rgba(26, 26, 46, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#7ec89b';
      ctx.font = `${fontSize}px JetBrains Mono, monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    }

    const interval = setInterval(draw, 33);

    setTimeout(() => {
      clearInterval(interval);
      canvas.remove();
    }, duration);
  }

  // === Command execution ===

  async function execute(rawInput) {
    const trimmed = rawInput.trim();
    if (!trimmed) return;

    // Add to history (dedupe consecutive; skip when replaying from URL hash)
    if (!suppressHashSync && history[0] !== trimmed) {
      history.unshift(trimmed);
      if (history.length > HISTORY_CAP) history.length = HISTORY_CAP;
      saveHistory();
    }
    historyIdx = -1;
    clearGhost();

    // Echo the command
    echoCommand(trimmed);
    addBlankLine();

    // Sync URL hash so the command is shareable
    updateHash(trimmed);

    // Parse command and args
    const parts = trimmed.split(/\s+/);
    // Handle multi-word commands like "hire me"
    let cmdName = parts[0].toLowerCase();
    let args = parts.slice(1);

    // Check for "hire me" as a two-word command
    if (cmdName === 'hire' && args[0]?.toLowerCase() === 'me') {
      cmdName = 'hire me';
      args = args.slice(1);
    }

    // Check for "rm -rf" as a special case
    if (cmdName === 'rm') {
      // args stay as-is, the rm handler checks for -rf
    }

    const cmd = Commands.get(cmdName);

    if (!cmd) {
      const block = addOutputBlock();
      const suggestion = findClosestCommand(cmdName);
      let msg = `Command not found: \`${cmdName}\``;
      if (suggestion) {
        msg += `\n\nDid you mean **${suggestion}**?`;
      }
      msg += `\n\nType \`help\` to see available commands.`;
      isStreaming = true;
      input.disabled = true;
      await StreamingEngine.stream(block, msg);
      input.disabled = false;
      isStreaming = false;
      addBlankLine();
      input.focus();
      return;
    }

    // Execute
    isStreaming = true;
    input.disabled = true;

    try {
      const result = await cmd.handler(args);

      if (result === null) {
        // Command handled its own output (e.g., clear)
      } else if (result === '__MATRIX__') {
        matrixRain();
        const block = addOutputBlock();
        await StreamingEngine.stream(block, "Follow the white rabbit... 🐇");
      } else {
        const block = addOutputBlock();
        await StreamingEngine.stream(block, result);
      }
    } catch (err) {
      const block = addOutputBlock();
      await StreamingEngine.stream(block, `Error: ${err.message}`);
    }

    addBlankLine();
    input.disabled = false;
    isStreaming = false;
    input.focus();
  }

  // === Fuzzy command matching ===

  function findClosestCommand(input) {
    const cmds = Commands.allVisible().map(c => c.name);
    let best = null;
    let bestDist = Infinity;

    for (const cmd of cmds) {
      const d = levenshtein(input.toLowerCase(), cmd.toLowerCase());
      if (d < bestDist && d <= 3) {
        bestDist = d;
        best = cmd;
      }
    }
    return best;
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  // === Input handling ===

  // === Ghost / inline suggestion ===

  function clearGhost() {
    if (ghostTyped) ghostTyped.textContent = '';
    if (ghostTail) ghostTail.textContent = '';
    if (ghost) {
      delete ghost.dataset.full;
      delete ghost.dataset.kind;
    }
    if (ghostHint) ghostHint.innerHTML = '';
  }

  function setGhost(full, kind) {
    if (!ghost || !ghostTyped || !ghostTail) return;
    const val = input.value;
    ghost.dataset.full = full;
    ghost.dataset.kind = kind;
    if (kind === 'complete') {
      // Mirror the typed portion (transparent) then show the remaining suffix
      ghostTyped.textContent = val;
      ghostTail.textContent = full.slice(val.length);
    } else {
      // Fuzzy "did you mean" — show as an inline hint after the input
      ghostTyped.textContent = val;
      ghostTail.textContent = `  → ${full}?`;
    }
    if (ghostHint) {
      ghostHint.innerHTML = '<kbd>tab</kbd>to accept';
    }
  }

  function refreshGhost() {
    if (!ghost) return;
    const val = input.value;
    const trimmedLeft = val.replace(/^\s+/, '');
    if (!trimmedLeft || /\s/.test(trimmedLeft)) {
      // Only suggest for a single partial command word
      clearGhost();
      return;
    }
    const cmds = Commands.allVisible().map((c) => c.name);
    const lower = trimmedLeft.toLowerCase();
    // Prefix match wins
    let match = cmds.find((c) => c.startsWith(lower) && c !== lower);
    let kind = 'complete';
    // Otherwise fall back to a fuzzy "did you mean"
    if (!match) {
      match = findClosestCommand(lower);
      kind = 'suggest';
    }
    if (!match || match === lower) {
      clearGhost();
      return;
    }
    setGhost(match, kind);
  }

  function acceptGhost() {
    if (!ghost || !ghost.dataset.full) return false;
    input.value = ghost.dataset.full + ' ';
    clearGhost();
    return true;
  }

  input.addEventListener('input', () => {
    if (!isStreaming) refreshGhost();
  });

  input.addEventListener('keydown', (e) => {
    if (isStreaming) {
      e.preventDefault();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const val = input.value;
      input.value = '';
      clearGhost();
      execute(val);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIdx < history.length - 1) {
        historyIdx++;
        input.value = history[historyIdx];
        clearGhost();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx > 0) {
        historyIdx--;
        input.value = history[historyIdx];
      } else {
        historyIdx = -1;
        input.value = '';
      }
      clearGhost();
      return;
    }

    // Accept ghost suggestion with Right/End at end of input
    if ((e.key === 'ArrowRight' || e.key === 'End') && ghost && ghost.textContent) {
      const atEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
      if (atEnd && acceptGhost()) {
        e.preventDefault();
        return;
      }
    }

    // Tab autocomplete
    if (e.key === 'Tab') {
      e.preventDefault();
      handleTab();
    }

    if (e.key === 'Escape') {
      clearGhost();
    }
  });

  function handleTab() {
    const raw = input.value;
    const trimmed = raw.trim();
    if (!trimmed) return;

    // Arg-level completion: cycle project IDs only when the user has
    // committed to the `project` command (trailing space or explicit arg).
    const parts = trimmed.split(/\s+/);
    const inProjectArgMode = parts[0].toLowerCase() === 'project'
      && (parts.length > 1 || /\s$/.test(raw));
    if (inProjectArgMode) {
      cycleProjectArg(raw, parts);
      return;
    }

    const cmds = Commands.allVisible().map((c) => c.name);
    const lower = trimmed.toLowerCase();
    const matches = cmds.filter((c) => c.startsWith(lower));

    if (matches.length === 1) {
      input.value = matches[0] + ' ';
      clearGhost();
      return;
    }

    if (matches.length > 1) {
      const lcp = longestCommonPrefix(matches);
      if (lcp.length > lower.length) {
        // Make progress to the longest common prefix and surface the
        // candidate list so the user knows there are multiple options.
        input.value = lcp;
        const block = addOutputBlock();
        block.classList.add('command-echo');
        block.textContent = matches.join('   ');
        addBlankLine();
        scrollToBottom();
        refreshGhost();
        return;
      }
      // LCP didn't progress — accept the displayed ghost (first match).
      if (acceptGhost()) return;
      const block = addOutputBlock();
      block.classList.add('command-echo');
      block.textContent = matches.join('   ');
      addBlankLine();
      scrollToBottom();
      refreshGhost();
      return;
    }

    // No prefix matches — fall back to accepting a fuzzy ghost suggestion
    acceptGhost();
  }

  function cycleProjectArg(raw, parts) {
    // Try to read project IDs from cached content
    const c = Commands.contentCache && Commands.contentCache();
    if (!c || !c.projects) {
      // Fall back to just appending a space if we don't have data yet
      if (!/\s$/.test(raw)) input.value = raw + ' ';
      return;
    }
    const ids = c.projects.map((p) => String(p.id));
    if (parts.length === 1) {
      input.value = `project ${ids[0]}`;
      return;
    }
    const current = parts[1];
    const idx = ids.indexOf(current);
    const next = ids[(idx + 1) % ids.length];
    input.value = `project ${next}`;
  }

  function longestCommonPrefix(arr) {
    if (!arr.length) return '';
    let prefix = arr[0];
    for (let i = 1; i < arr.length; i++) {
      while (!arr[i].startsWith(prefix)) {
        prefix = prefix.slice(0, -1);
        if (!prefix) return '';
      }
    }
    return prefix;
  }

  // Keep focus on input when clicking terminal
  document.getElementById('terminal').addEventListener('click', (e) => {
    if (!window.getSelection().toString()) {
      input.focus();
    }
  });

  // Mobile chips
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      if (isStreaming) return;
      const cmd = chip.getAttribute('data-cmd');
      input.value = '';
      execute(cmd);
    });
  });

  // === Welcome message on load ===

  async function init() {
    try {
      const c = await Commands.loadContent();
      const block = addOutputBlock();
      isStreaming = true;
      input.disabled = true;
      await StreamingEngine.stream(block, c.welcome);
      addBlankLine();
      input.disabled = false;
      isStreaming = false;
      input.focus();

      // Deep link: if URL has a hash, run the matching command
      const initial = hashToCommand(location.hash);
      if (initial) {
        suppressHashSync = true;
        await execute(initial);
        suppressHashSync = false;
      }
    } catch {
      const block = addOutputBlock();
      block.textContent = 'Welcome to DankSite. Type "help" to get started.';
    }
  }

  // Respond to back/forward navigation between deep links
  window.addEventListener('hashchange', () => {
    if (isStreaming) return;
    const cmd = hashToCommand(location.hash);
    if (cmd) {
      suppressHashSync = true;
      execute(cmd).finally(() => { suppressHashSync = false; });
    }
  });

  init();

  return { execute };
})();
