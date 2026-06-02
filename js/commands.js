/**
 * Command registry — maps command names to handler functions.
 * Each handler returns a string (streamed) or an array of DOM nodes (streamed as nodes).
 */
const Commands = (() => {
  let content = null;

  async function loadContent() {
    if (content) return content;
    const resp = await fetch('data/content.json');
    content = await resp.json();
    return content;
  }

  // Synchronous accessor for already-loaded content (used by autocomplete)
  function contentCache() {
    return content;
  }

  const registry = {};

  function register(name, handler, description, hidden = false) {
    registry[name] = { handler, description, hidden };
  }

  function get(name) {
    return registry[name] || null;
  }

  function allVisible() {
    return Object.entries(registry)
      .filter(([, v]) => !v.hidden)
      .map(([name, v]) => ({ name, description: v.description }));
  }

  // === help ===
  register('help', async () => {
    const cmds = allVisible();
    const lines = ['## Available Commands\n'];
    cmds.forEach(({ name, description }) => {
      lines.push(`  **${name.padEnd(14)}** ${description}`);
    });
    lines.push('\n Type a command and press Enter.');
    return lines.join('\n');
  }, 'Show this help message');

  // === bio ===
  register('bio', async () => {
    const c = await loadContent();
    const b = c.bio;
    const lines = [];

    lines.push(`## ${c.name}`);
    lines.push(`${c.title}\n`);
    lines.push('---');
    lines.push(`\n${b.summary}\n`);

    lines.push('## Education\n');
    b.education.forEach(e => lines.push(`  • ${e}`));

    lines.push('\n## Experience\n');
    b.experience.forEach(exp => {
      lines.push(`  **${exp.role}** — ${exp.company}`);
      lines.push(`  ${exp.period}`);
      exp.highlights.forEach(h => lines.push(`    • ${h}`));
      lines.push('');
    });

    lines.push('## Interests\n');
    b.interests.forEach(i => lines.push(`  • ${i}`));

    return lines.join('\n');
  }, 'About me — education, experience, interests');

  // === projects ===
  register('projects', async () => {
    const c = await loadContent();
    const lines = ['## Projects\n'];

    // Group projects by category — academic projects render under Personal with an (Academic) tag.
    const sections = [
      { heading: 'Work', categories: ['work'] },
      { heading: 'Personal', categories: ['personal', 'academic'] }
    ];

    const renderProject = (p) => {
      const academicTag = p.category === 'academic' ? ' (Academic)' : '';
      lines.push(`  **[${p.id}]** ${p.title}`);
      lines.push(`      ${p.tech.join(' • ')}  —  ${p.status}${academicTag}`);
      if (p.link && p.link !== '#') {
        lines.push(`      🔗 [${p.link}](${p.link})`);
      }
      lines.push('');
    };

    sections.forEach(({ heading, categories }) => {
      const items = c.projects.filter(p => categories.includes(p.category));
      if (!items.length) return;
      lines.push(`### ${heading}\n`);
      items.forEach(renderProject);
    });

    // Fallback: any project missing a recognized category still shows up.
    const known = new Set(sections.flatMap(s => s.categories));
    const uncategorized = c.projects.filter(p => !known.has(p.category));
    if (uncategorized.length) {
      lines.push(`### Other\n`);
      uncategorized.forEach(renderProject);
    }

    lines.push(`\n Type \`project <number>\` for full details on a specific project.`);
    return lines.join('\n');
  }, 'List all projects');

  // === project <n> ===
  register('project', async (args) => {
    const c = await loadContent();
    const id = parseInt(args[0]);
    const p = c.projects.find(proj => proj.id === id);

    if (!p) {
      const ids = c.projects.map(proj => proj.id).join(', ');
      return `Project not found. Available: ${ids}`;
    }

    const lines = [];
    lines.push(`## ${p.title}\n`);
    lines.push('---');
    lines.push(`\n${p.description}\n`);
    lines.push(`**Tech Stack:** ${p.tech.join(', ')}`);
    lines.push(`**Status:** ${p.status}`);
    lines.push(`**Link:** [${p.link}](${p.link})`);

    return lines.join('\n');
  }, 'View project details — usage: project <number>');

  // === skills ===
  register('skills', async () => {
    const c = await loadContent();
    const lines = ['## Technical Skills\n'];

    Object.entries(c.skills).forEach(([category, items]) => {
      lines.push(`  **${category}**`);
      lines.push(`    ${items.join(' • ')}\n`);
    });

    return lines.join('\n');
  }, 'Technical skills breakdown');

  // === contact ===
  register('contact', async () => {
    const c = await loadContent();
    const lines = ['## Get in Touch\n'];

    Object.values(c.contact).forEach(({ label, url, display }) => {
      lines.push(`  **${label.padEnd(14)}** [${display}](${url})`);
    });

    lines.push('\n Feel free to reach out — I\'m always happy to chat about data, ML, and building things.');
    return lines.join('\n');
  }, 'How to reach me');

  // === clear ===
  register('clear', async () => {
    document.getElementById('terminal-output').innerHTML = '';
    return null; // Signal: no output to stream
  }, 'Clear the terminal');

  // === share ===
  register('share', async () => {
    const url = location.href;
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        copied = true;
      }
    } catch {
      copied = false;
    }
    const lines = ['## Share this view\n'];
    lines.push(`  **URL** [${url}](${url})`);
    lines.push('');
    lines.push(copied
      ? ' ✅ Copied to clipboard.'
      : ' ℹ️  Copy the URL above (clipboard access was unavailable).');
    return lines.join('\n');
  }, 'Copy a shareable deep-link to the current view');

  // === search ===
  register('search', async (args) => {
    const query = (args || []).join(' ').trim();
    if (!query) {
      return 'Usage: `search <query>` — searches bio, projects, and skills.';
    }
    const c = await loadContent();
    const q = query.toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);

    const score = (text) => {
      if (!text) return 0;
      const t = String(text).toLowerCase();
      let s = 0;
      if (t.includes(q)) s += 10;
      for (const tok of tokens) if (t.includes(tok)) s += 1;
      return s;
    };

    const hits = [];

    // Bio summary + interests
    const bioScore = score(c.bio.summary) + c.bio.interests.reduce((a, i) => a + score(i), 0);
    if (bioScore > 0) {
      hits.push({ score: bioScore, command: 'bio', label: 'Bio', snippet: snippet(c.bio.summary, q) });
    }

    // Experience highlights
    c.bio.experience.forEach((exp) => {
      let s = score(exp.role) + score(exp.company);
      let bestSnip = `${exp.role} — ${exp.company}`;
      exp.highlights.forEach((h) => {
        const hs = score(h);
        s += hs;
        if (hs > 0) bestSnip = snippet(h, q);
      });
      if (s > 0) hits.push({ score: s, command: 'bio', label: `Experience: ${exp.company}`, snippet: bestSnip });
    });

    // Projects
    c.projects.forEach((p) => {
      const s = score(p.title) * 2 + score(p.description) + p.tech.reduce((a, t) => a + score(t), 0);
      if (s > 0) hits.push({ score: s, command: `project ${p.id}`, label: `Project [${p.id}] ${p.title}`, snippet: snippet(p.description, q) });
    });

    // Skills
    Object.entries(c.skills).forEach(([cat, items]) => {
      const matches = items.filter((it) => score(it) > 0);
      if (matches.length) {
        hits.push({ score: matches.length * 3, command: 'skills', label: `Skills: ${cat}`, snippet: matches.join(' • ') });
      }
    });

    if (!hits.length) return `No matches for \`${query}\`.`;

    hits.sort((a, b) => b.score - a.score);
    const lines = [`## Results for "${query}"\n`];
    hits.slice(0, 10).forEach((h) => {
      lines.push(`  **${h.label}**`);
      if (h.snippet) lines.push(`    ${h.snippet}`);
      lines.push(`    → run \`${h.command}\` for more`);
      lines.push('');
    });
    return lines.join('\n');
  }, 'Search bio, projects, and skills — usage: search <query>');

  function snippet(text, query) {
    if (!text) return '';
    const t = String(text);
    const idx = t.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return t.length > 120 ? t.slice(0, 117) + '…' : t;
    const start = Math.max(0, idx - 40);
    const end = Math.min(t.length, idx + query.length + 60);
    return (start > 0 ? '…' : '') + t.slice(start, end) + (end < t.length ? '…' : '');
  }

  return { register, get, allVisible, loadContent, contentCache };
})();
