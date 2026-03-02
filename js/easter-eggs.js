/**
 * Easter eggs — hidden commands for personality and fun.
 */
(() => {
  Commands.register('sudo', async () => {
    return "Nice try. You don't have root access to my career. \n\nBut you *can* run `contact` to discuss opportunities.";
  }, '', true);

  Commands.register('hire me', async () => {
    const lines = [
      '## 🚀 Why You Should Hire Me\n',
      '---',
      '',
      '  ✅ 4 years shipping production ML at Microsoft',
      '  ✅ Builds AI-forward tools (you\'re looking at one)',
      '  ✅ Bridges the gap between research and production',
      '  ✅ Writes code that humans can actually read',
      '  ✅ Strong communicator who speaks both "business" and "model weights"',
      '',
      '---',
      '',
      "Convinced? Run `contact` to get in touch.",
    ];
    return lines.join('\n');
  }, '', true);

  Commands.register('exit', async () => {
    return "There is no exit. Only more portfolio. 🚪\n\nTry `help` to see what else you can explore.";
  }, '', true);

  Commands.register('rm', async (args) => {
    if (args.join(' ').includes('-rf')) {
      return "I appreciate the chaos energy, but no. \n\nMy portfolio is immutable. Try `projects` instead.";
    }
    return "rm: permission denied. This terminal is read-only (mostly).";
  }, '', true);

  Commands.register('ls', async () => {
    const items = [
      'drwxr-xr-x  career/',
      'drwxr-xr-x  projects/',
      'drwxr-xr-x  skills/',
      '-rw-r--r--  ambition.txt',
      '-rw-r--r--  coffee_addiction.log',
      '-rw-r--r--  curiosity.dat',
      '-rwxr-xr-x  hustle.sh',
    ];
    return '## ~/ \n\n' + items.map(i => `  ${i}`).join('\n');
  }, '', true);

  Commands.register('cd', async () => {
    return "You can't `cd` out of this portfolio. You're stuck here with my accomplishments. 📂";
  }, '', true);

  Commands.register('pwd', async () => {
    return '/home/visitor/whitneys-amazing-portfolio';
  }, '', true);

  Commands.register('whoami', async () => {
    return "visitor — but the real question is... are you a recruiter? 👀\n\nRun `hire me` to find out why that matters.";
  }, '', true);

  Commands.register('coffee', async () => {
    const art = [
      '        ( (',
      '         ) )',
      '      ........',
      '      |      |]',
      '      \\      /',
      '       `----\'',
      '',
      '  Here, have a virtual coffee. ☕',
      '  You\'ll need the energy to read',
      '  through all my accomplishments.',
    ];
    return art.join('\n');
  }, '', true);

  Commands.register('matrix', async () => {
    return '__MATRIX__'; // Special signal handled by terminal.js
  }, '', true);

  Commands.register('ping', async () => {
    return 'PONG 🏓\n\nLatency: 0ms (because this portfolio is blazing fast)';
  }, '', true);

  Commands.register('cat', async () => {
    const art = [
      '   /\\_/\\  ',
      '  ( o.o ) ',
      '   > ^ <  ',
      '',
      "  You said cat. Here's a cat. 🐱",
      "  For actual content, try `bio` or `projects`.",
    ];
    return art.join('\n');
  }, '', true);
})();
