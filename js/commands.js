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

    c.projects.forEach((p) => {
      lines.push(`  **[${p.id}]** ${p.title}`);
      lines.push(`      ${p.tech.join(' • ')}  —  ${p.status}`);
      if (p.link && p.link !== '#') {
        lines.push(`      🔗 [${p.link}](${p.link})`);
      }
      lines.push('');
    });

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

  return { register, get, allVisible, loadContent };
})();
