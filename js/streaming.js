/**
 * Streaming engine — token-by-token text rendering that mimics LLM output.
 */
const StreamingEngine = (() => {
  const DEFAULT_DELAY = 25;
  const CHUNK_SIZE_MIN = 1;
  const CHUNK_SIZE_MAX = 3;

  /**
   * Stream text into a target element, word by word.
   * Supports simple markup: **bold**, [text](url), `code`, ## headers
   * @param {HTMLElement} target - Element to stream into
   * @param {string} text - Raw text to stream
   * @param {object} opts - { delay, onChunk }
   * @returns {Promise<void>} Resolves when streaming completes
   */
  function stream(target, text, opts = {}) {
    const delay = opts.delay || DEFAULT_DELAY;

    return new Promise((resolve) => {
      const parsed = parseMarkup(text);
      const cursor = document.createElement('span');
      cursor.className = 'streaming-cursor';
      target.appendChild(cursor);

      let i = 0;

      function renderNext() {
        if (i >= parsed.length) {
          cursor.remove();
          resolve();
          return;
        }

        const chunkSize = CHUNK_SIZE_MIN + Math.floor(Math.random() * (CHUNK_SIZE_MAX - CHUNK_SIZE_MIN + 1));
        const end = Math.min(i + chunkSize, parsed.length);

        for (; i < end; i++) {
          target.insertBefore(parsed[i], cursor);
        }

        scrollTerminal();

        // Vary delay slightly for natural feel
        const jitter = delay + (Math.random() * 15 - 7);
        setTimeout(renderNext, Math.max(5, jitter));
      }

      renderNext();
    });
  }

  /**
   * Parse simple markup into an array of DOM nodes (one per word/token).
   */
  function parseMarkup(text) {
    const nodes = [];
    const lines = text.split('\n');

    lines.forEach((line, lineIdx) => {
      if (lineIdx > 0) {
        nodes.push(document.createElement('br'));
      }

      // Section header: ## Header
      if (line.startsWith('## ')) {
        const span = document.createElement('span');
        span.className = 'section-header';
        span.textContent = line.slice(3);
        nodes.push(span);
        return;
      }

      // Separator: ---
      if (line.trim() === '---') {
        const span = document.createElement('span');
        span.className = 'separator';
        span.textContent = '─'.repeat(40);
        nodes.push(span);
        return;
      }

      const tokens = tokenize(line);
      tokens.forEach((token) => {
        nodes.push(tokenToNode(token));
      });
    });

    return nodes;
  }

  /**
   * Split a line into tokens, preserving markup delimiters.
   */
  function tokenize(line) {
    const tokens = [];
    // Match: **bold**, `code`, [text](url), or plain words
    const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\S+|\s+)/g;
    let match;
    while ((match = regex.exec(line)) !== null) {
      tokens.push(match[0]);
    }
    return tokens;
  }

  /**
   * Convert a token string to a DOM node.
   */
  function tokenToNode(token) {
    // Bold: **text**
    if (token.startsWith('**') && token.endsWith('**')) {
      const span = document.createElement('span');
      span.className = 'text-bold text-highlight';
      span.textContent = token.slice(2, -2);
      return span;
    }

    // Code: `text`
    if (token.startsWith('`') && token.endsWith('`')) {
      const span = document.createElement('span');
      span.className = 'text-accent';
      span.textContent = token.slice(1, -1);
      return span;
    }

    // Link: [text](url)
    const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const a = document.createElement('a');
      a.href = linkMatch[2];
      a.textContent = linkMatch[1];
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      return a;
    }

    // Plain text
    return document.createTextNode(token);
  }

  /**
   * Stream pre-built DOM nodes (for commands that build their own HTML).
   */
  function streamNodes(target, nodeArray, opts = {}) {
    const delay = opts.delay || DEFAULT_DELAY;

    return new Promise((resolve) => {
      const cursor = document.createElement('span');
      cursor.className = 'streaming-cursor';
      target.appendChild(cursor);

      let i = 0;

      function renderNext() {
        if (i >= nodeArray.length) {
          cursor.remove();
          resolve();
          return;
        }

        target.insertBefore(nodeArray[i], cursor);
        i++;
        scrollTerminal();

        const jitter = delay + (Math.random() * 10 - 5);
        setTimeout(renderNext, Math.max(5, jitter));
      }

      renderNext();
    });
  }

  function scrollTerminal() {
    const output = document.getElementById('terminal-output');
    if (output) {
      output.scrollTop = output.scrollHeight;
    }
  }

  return { stream, streamNodes, parseMarkup };
})();
