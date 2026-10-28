import { expect, test, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Anthropic's API is mocked with a recorded-shape event stream: the real SDK runs in the browser,
// under the real CSP, but no request leaves the machine.
function sse(events: object[]): string {
  return events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
}

function message(id: string, blocks: object[][], stop: string): string {
  return sse([
    { type: 'message_start', message: { id, type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 50, output_tokens: 1 } } },
    ...blocks.flat(),
    { type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 30 } },
    { type: 'message_stop' },
  ]);
}

const text = (index: number, t: string) => [
  { type: 'content_block_start', index, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index, delta: { type: 'text_delta', text: t } },
  { type: 'content_block_stop', index },
];

const toolUse = (index: number, id: string, name: string, input: object) => [
  { type: 'content_block_start', index, content_block: { type: 'tool_use', id, name, input: {} } },
  { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(input) } },
  { type: 'content_block_stop', index },
];

// A made-up key, built at run time so it never sits in the repo looking like a real one.
const KEY = ['sk', 'ant', 'test'].join('-') + '-' + 'x'.repeat(32);

test('the assistant proposes a bed, the gardener applies it, and one undo takes it back', async ({ page }) => {
  const bodies: { headers: Record<string, string>; body: { messages: { role: string; content: unknown }[]; model: string } }[] = [];
  await page.route('https://api.anthropic.com/**', async (route: Route) => {
    const req = route.request();
    bodies.push({ headers: await req.allHeaders(), body: req.postDataJSON() });
    const first = bodies.length === 1;
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' },
      body: first
        ? message('msg_1', [text(0, 'I will add a herb bed by the door.'), toolUse(1, 'toolu_1', 'add_bed', { name: 'Herb bed', kind: 'raised-bed', cols: 2, rows: 4 })], 'tool_use')
        : message('msg_2', [text(0, 'Done planning: a 2 by 4 herb bed, ready for you to review.')], 'end_turn'),
    });
  });

  await page.clock.install({ time: new Date('2027-03-01T09:00:00') });
  await page.goto('/');
  await page.getByRole('button', { name: 'I know my frost dates' }).click();
  await page.getByLabel('Typical last spring frost').fill('2027-04-16');
  await page.getByLabel('Typical first fall frost').fill('2027-11-04');
  await page.getByRole('button', { name: 'Use these dates' }).click();
  await page.getByRole('button', { name: 'Start planning' }).click();

  await page.getByRole('button', { name: 'Ask the assistant' }).click();
  const panel = page.getByRole('dialog', { name: 'Ask about your garden' });
  await expect(panel.getByText('The assistant is optional.', { exact: false })).toBeVisible();
  await panel.getByLabel('Your Anthropic API key').fill('not a key');
  await panel.getByRole('button', { name: 'Save' }).click();
  await expect(panel.getByRole('alert')).toContainText('sk-ant-');
  await panel.getByLabel('Your Anthropic API key').fill(KEY);
  await panel.getByRole('button', { name: 'Save' }).click();

  await panel.getByLabel('Message').fill('Add a small herb bed');
  await panel.getByRole('button', { name: 'Send' }).click();
  await expect(panel.getByText('Done planning')).toBeVisible();
  await expect(panel.getByRole('listitem').filter({ hasText: 'New bed, Herb bed, 2 by 4 squares' })).toBeVisible();

  // Nothing reached the garden before Apply.
  const containers = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('gardensync.v8.doc') ?? 'null')?.doc.gardens[0]?.containers.map((c: { name: string }) => c.name) ?? []);
  expect(await containers()).not.toContain('Herb bed');

  const axe = await new AxeBuilder({ page }).include('.assistant').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations).toEqual([]);

  await panel.getByRole('button', { name: 'Apply to the garden' }).click();
  await expect(panel.getByText(/Applied 1 change/)).toBeVisible();
  await expect.poll(containers).toContain('Herb bed');

  // The requests: the key in its header, the default model, fallback on, and the tool result sent back.
  expect(bodies).toHaveLength(2);
  expect(bodies[0]!.headers['authorization']).toBe(`Bearer ${KEY}`);
  expect(bodies[0]!.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  expect(bodies[0]!.body.model).toBe('claude-sonnet-5-5');
  expect(bodies[0]!.headers['anthropic-beta']).toContain('server-side-fallback-2026-07-01');
  expect(JSON.stringify(bodies[1]!.body.messages.at(-1))).toContain('tool_result');

  // The key is stored apart from the garden and is not in the saved document.
  const saved = await page.evaluate(() => localStorage.getItem('gardensync.v8.doc') ?? '');
  expect(saved).not.toContain(KEY);

  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(page.getByRole('button', { name: 'Ask the assistant' })).toBeFocused();
  await page.keyboard.press('Control+z');
  await expect.poll(containers).not.toContain('Herb bed');
});
