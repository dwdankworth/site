/**
 * Terminal engine — input handling, command dispatch, history, and output rendering.
 */
const Terminal = (() => {
  const output = document.getElementById('terminal-output');
  const input = document.getElementById('terminal-input');
  const chips = document.querySelectorAll('.chip[data-cmd]');

  const history = [];
  let historyIdx = -1;
  let isStreaming = false;

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

    // Add to history
    history.unshift(trimmed);
    historyIdx = -1;

    // Echo the command
    echoCommand(trimmed);
    addBlankLine();

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

  input.addEventListener('keydown', (e) => {
    if (isStreaming) {
      e.preventDefault();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const val = input.value;
      input.value = '';
      execute(val);
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIdx < history.length - 1) {
        historyIdx++;
        input.value = history[historyIdx];
      }
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
    }

    // Tab autocomplete
    if (e.key === 'Tab') {
      e.preventDefault();
      const partial = input.value.trim().toLowerCase();
      if (!partial) return;

      const cmds = Commands.allVisible().map(c => c.name);
      const matches = cmds.filter(c => c.startsWith(partial));

      if (matches.length === 1) {
        input.value = matches[0] + ' ';
      }
    }
  });

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
    } catch (err) {
      const block = addOutputBlock();
      block.textContent = 'Welcome to DankSite. Type "help" to get started.';
    }
  }

  init();

  return { execute };
})();
