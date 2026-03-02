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
  await expect(input).toBeEnabled({ timeout: 10000 });
}

/**
 * Wait for the initial welcome message to finish streaming.
 */
async function waitForWelcome(page) {
  await page.goto('/');
  const input = page.locator('#terminal-input');
  await expect(input).toBeEnabled({ timeout: 10000 });
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

test('projects command lists all projects', async ({ page }) => {
  await waitForWelcome(page);
  await runCommand(page, 'projects');
  const output = getOutput(page);
  await expect(output).toContainText('[1]');
  await expect(output).toContainText('[2]');
  await expect(output).toContainText('[3]');
  await expect(output).toContainText('project <number>');
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
  await expect(output).toContainText('Data Engineering');
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
