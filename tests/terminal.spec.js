// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Type a command and wait for streaming to finish.
 * Streaming disables the input; we wait for it to re-enable.
 */
async function runCommand(page, command) {
  const input = page.locator('#terminal-input');
  await input.fill(command);
  await input.press('Enter');
  // Wait for streaming to finish (input gets re-enabled)
  await expect(input).toBeEnabled({ timeout: 30000 });
}

/**
 * Wait for the initial welcome message to finish streaming.
 */
async function waitForWelcome(page) {
  await page.goto('/');
  const input = page.locator('#terminal-input');
  await expect(input).toBeEnabled({ timeout: 30000 });
}

/**
 * Get the text content of the terminal output area.
 */
function getOutput(page) {
  return page.locator('#terminal-output');
}

// ─── Terminal Initialization ─────────────────────────────────────────────────

test('page loads and welcome message streams', async ({ page }) => {
  await waitForWelcome(page);
  const output = getOutput(page);
  await expect(output).toContainText('Welcome');
  await expect(output).toContainText("Type 'help' to see available commands");
});

// ─── Visible Commands ────────────────────────────────────────────────────────

test('help command shows all visible commands', async ({ page }) => {
  await waitForWelcome(page);
  await runCommand(page, 'help');
  const output = getOutput(page);
  const expectedCmds = ['help', 'bio', 'projects', 'project', 'skills', 'contact', 'clear'];
  for (const cmd of expectedCmds) {
    await expect(output).toContainText(cmd);
  }
});

test('bio command shows profile sections', async ({ page }) => {
  await waitForWelcome(page);
  await runCommand(page, 'bio');
  const output = getOutput(page);
  await expect(output).toContainText('Whitney Dankworth');
  await expect(output).toContainText('Education');
  await expect(output).toContainText('Experience');
  await expect(output).toContainText('Interests');
});

test('projects command lists all projects with links', async ({ page }) => {
  await waitForWelcome(page);
  await runCommand(page, 'projects');
  const output = getOutput(page);
  await expect(output).toContainText('[1]');
  await expect(output).toContainText('[2]');
  await expect(output).toContainText('[3]');
  await expect(output).toContainText('project <number>');
  // Projects with real links should render clickable anchors
  const links = output.locator('a[href^="https://github.com/"]');
  await expect(links.first()).toBeVisible();
  const count = await links.count();
  expect(count).toBeGreaterThanOrEqual(2);
});

test('project detail shows info and link', async ({ page }) => {
  await waitForWelcome(page);
  await runCommand(page, 'project 1');
  const output = getOutput(page);
  await expect(output).toContainText('Tech Stack:');
  await expect(output).toContainText('Status:');
  // Project link should be a clickable anchor
  const link = output.locator('a');
  await expect(link).toBeVisible();
});

test('skills command shows skill categories', async ({ page }) => {
  await waitForWelcome(page);
  await runCommand(page, 'skills');
  const output = getOutput(page);
  await expect(output).toContainText('ML & AI');
  await expect(output).toContainText('Data');
  await expect(output).toContainText('Languages');
  await expect(output).toContainText('Tools & Platforms');
});

test('contact command shows contact info', async ({ page }) => {
  await waitForWelcome(page);
  await runCommand(page, 'contact');
  const output = getOutput(page);
  await expect(output).toContainText('GitHub');
  await expect(output).toContainText('LinkedIn');
  await expect(output).toContainText('Email');
});

test('clear command empties terminal output', async ({ page }) => {
  await waitForWelcome(page);
  await runCommand(page, 'help');
  const output = getOutput(page);
  await expect(output).toContainText('Available Commands');
  await runCommand(page, 'clear');
  // After clear, the output should be empty
  await expect(output).toHaveText('');
});

// ─── Error Handling ──────────────────────────────────────────────────────────

test('unknown command shows error and fuzzy suggestion', async ({ page }) => {
  await waitForWelcome(page);
  await runCommand(page, 'helpp');
  const output = getOutput(page);
  await expect(output).toContainText('Command not found');
  await expect(output).toContainText('Did you mean');
  await expect(output).toContainText('help');
});

// ─── UI Interactions ─────────────────────────────────────────────────────────

test('tab autocomplete completes partial command', async ({ page }) => {
  await waitForWelcome(page);
  const input = page.locator('#terminal-input');
  await input.fill('sk');
  await input.press('Tab');
  await expect(input).toHaveValue('skills ');
});

// ─── History persistence ─────────────────────────────────────────────────────

test('command history persists across reloads', async ({ page }) => {
  test.setTimeout(45000);
  await waitForWelcome(page);
  await runCommand(page, 'contact');
  await runCommand(page, 'help');
  await page.reload();
  const input = page.locator('#terminal-input');
  await expect(input).toBeEnabled({ timeout: 30000 });
  await input.press('ArrowUp');
  await expect(input).toHaveValue('help');
  await input.press('ArrowUp');
  await expect(input).toHaveValue('contact');
});

// ─── Deep-link routing ───────────────────────────────────────────────────────

test('hash deep-link runs matching command on load', async ({ page }) => {
  await page.goto('/#projects');
  const input = page.locator('#terminal-input');
  await expect(input).toBeEnabled({ timeout: 30000 });
  // Wait for the deep-linked command to also finish
  await page.waitForTimeout(500);
  await expect(input).toBeEnabled({ timeout: 30000 });
  const output = getOutput(page);
  await expect(output).toContainText('[1]');
  await expect(output).toContainText('[2]');
});

test('project deep-link routes via hash', async ({ page }) => {
  await page.goto('/#project/2');
  const input = page.locator('#terminal-input');
  await expect(input).toBeEnabled({ timeout: 30000 });
  await page.waitForTimeout(500);
  await expect(input).toBeEnabled({ timeout: 30000 });
  const output = getOutput(page);
  await expect(output).toContainText('Tech Stack:');
});

test('running a command updates the URL hash', async ({ page }) => {
  await waitForWelcome(page);
  await runCommand(page, 'skills');
  await expect(page).toHaveURL(/#skills$/);
});

// ─── Share command ───────────────────────────────────────────────────────────

test('share command shows current URL', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await waitForWelcome(page);
  await runCommand(page, 'bio');
  await runCommand(page, 'share');
  const output = getOutput(page);
  await expect(output).toContainText('Share this view');
  await expect(output).toContainText('#bio');
});

// ─── Search command ──────────────────────────────────────────────────────────

test('search finds matching projects', async ({ page }) => {
  await waitForWelcome(page);
  await runCommand(page, 'search raspberry');
  const output = getOutput(page);
  await expect(output).toContainText('Results for');
  await expect(output).toContainText('Raspberry');
  await expect(output).toContainText('project 1');
});

test('search with no matches shows friendly message', async ({ page }) => {
  await waitForWelcome(page);
  await runCommand(page, 'search zzzzzzzzz');
  const output = getOutput(page);
  await expect(output).toContainText('No matches');
});

test('search with no query shows usage', async ({ page }) => {
  await waitForWelcome(page);
  await runCommand(page, 'search');
  const output = getOutput(page);
  await expect(output).toContainText('Usage:');
});

// ─── Tab completion improvements ─────────────────────────────────────────────

test('tab with ambiguous prefix shows candidates', async ({ page }) => {
  await waitForWelcome(page);
  const input = page.locator('#terminal-input');
  await input.fill('p');
  await input.press('Tab');
  const output = getOutput(page);
  // Both `projects` and `project` start with `p`
  await expect(output).toContainText('projects');
  await expect(output).toContainText('project');
});

test('tab cycles project IDs after "project "', async ({ page }) => {
  await waitForWelcome(page);
  // Load content first so the ID list is available
  await runCommand(page, 'projects');
  const input = page.locator('#terminal-input');
  // Trailing space commits to the `project` command and enters arg mode
  await input.fill('project ');
  await input.press('Tab');
  await expect(input).toHaveValue('project 1');
  await input.press('Tab');
  await expect(input).toHaveValue('project 2');
});

test('tab on bare "project" completes to "projects", not arg cycle', async ({ page }) => {
  await waitForWelcome(page);
  const input = page.locator('#terminal-input');
  await input.fill('project');
  await input.press('Tab');
  // The ghost shows `projects` as a prefix completion; Tab accepts it
  await expect(input).toHaveValue('projects ');
});

// ─── A11y attributes ─────────────────────────────────────────────────────────

test('terminal has accessible labels and live region', async ({ page }) => {
  await waitForWelcome(page);
  const input = page.locator('#terminal-input');
  await expect(input).toHaveAttribute('aria-label', /command input/i);
  const out = page.locator('#terminal-output');
  await expect(out).toHaveAttribute('role', 'log');
  await expect(out).toHaveAttribute('aria-live', 'polite');
});
