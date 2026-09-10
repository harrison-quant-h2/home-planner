import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { listing } from '../listing-helpers.js';
import { demo } from '../helpers.js';

async function importListing(page, packet = listing()) {
  await page.locator('#listing-file').setInputFiles({
    name: 'listing.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(packet)),
  });
}
async function downloadProject(page) {
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  const wait = page.waitForEvent('download');
  await page.locator('#download-project').click();
  return JSON.parse(await readFile(await (await wait).path(), 'utf8'));
}
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'References', exact: true }).click();
});
test('listing import, room/window assignment, checkpoint reset, reload, undo and JSON export', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const requested = [];
  page.on('request', (r) => {
    if (r.url().includes('images.example.org')) requested.push(r.url());
  });
  await importListing(page);
  await expect(page.locator('#listing-preview-summary')).toContainText(
    'No measured model layout supplied',
  );
  await expect(page.locator('#attached-references')).toBeHidden();
  await page.locator('#attach-listing').click();
  await expect(page.locator('#project-name')).toHaveText('Courtyard House');
  await page
    .getByRole('button', { name: 'Select reference Garden view', exact: true })
    .click();
  await page.locator('#reference-room').selectOption('living');
  await page.locator('#reference-side').selectOption('-1');
  await page.locator('#reference-mirror').check();
  await page.locator('#link-window').click();
  await expect(page.locator('#window-links button')).toHaveCount(1);
  await page.locator('#save-layout').click();
  await expect(page.locator('#saved')).toHaveText('Matches saved layout');
  await page.locator('#window-links button').click();
  await expect(page.locator('#window-links button')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'References', exact: true }).click();
  await page.locator('#reset-layout').click();
  await expect(page.locator('#window-links button')).toHaveCount(1);
  await page.locator('#undo').click();
  await expect(page.locator('#window-links button')).toHaveCount(0);
  await page.locator('#redo').click();
  await expect(page.locator('#window-links button')).toHaveCount(1);
  const snapshot = await downloadProject(page);
  expect(snapshot.project.references.bindings[0]).toMatchObject({
    imageId: 'garden',
    side: -1,
    flipX: true,
  });
  expect(snapshot.project.references.images[0].roomId).toBe('living');
  expect(snapshot.project.items).toEqual(demo().items);
  expect(requested).toEqual([]);
  expect(errors).toEqual([]);
});
test('malformed listing and unavailable direct MCP leave project unchanged; imported titles remain plain text', async ({
  page,
}) => {
  await importListing(page, { isError: true });
  await expect(page.locator('#reference-status')).toContainText(
    'Could not import',
  );
  await expect(page.locator('#attached-references')).toBeHidden();
  await page.locator('#listing-query').fill('Fictional Courtyard');
  await page.locator('#lookup-listing').click();
  await expect(page.locator('#reference-status')).toContainText(
    'local MCP bridge',
  );
  const packet = listing();
  packet.source.title = '<img src=x onerror=alert(1)>';
  packet.images[0].caption = '<script>alert(1)</script>';
  await importListing(page, packet);
  await page.locator('#attach-listing').click();
  await expect(page.locator('#reference-listing-title')).toHaveText(
    packet.source.title,
  );
  await expect(page.locator('#reference-listing-title img')).toHaveCount(0);
  await page
    .getByRole('button', {
      name: 'Select reference ' + packet.images[0].caption,
      exact: true,
    })
    .click();
  await expect(page.locator('#reference-photo-title script')).toHaveCount(0);
  const invalid = listing();
  invalid.images[0].url = 'javascript:alert(1)';
  await importListing(page, invalid);
  await expect(page.locator('#reference-status')).toContainText(
    'Could not import',
  );
  await expect(page.locator('#reference-listing-title')).toHaveText(
    packet.source.title,
  );
});
test('approved image loading builds window photos; GLB stays free of listing imagery', async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Original diagram for checking window orientation and cropping; no external download.
  const diagram =
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#aad1e3"/><path d="M0 300L180 130L390 320L580 90L800 300V400H0Z" fill="#557d50"/><rect y="350" width="800" height="50" fill="#c8af73"/><text x="70" y="80" font-family="sans-serif" font-size="40" fill="#123846">LEFT</text><text x="590" y="80" font-family="sans-serif" font-size="40" fill="#123846">RIGHT</text></svg>';
  await page.route('https://images.example.org/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: diagram,
    }),
  );
  await importListing(page);
  await page.locator('#attach-listing').click();
  await page
    .getByRole('button', { name: 'Select reference Garden view', exact: true })
    .click();
  await page.locator('#link-window').click();
  await page.locator('#load-reference-images').click();
  await expect(page.locator('#reference-status')).toContainText(
    '1 window photo loaded',
  );
  await page.locator('#reference-window').selectOption('0:1');
  await page.locator('#link-window').click();
  await expect(page.locator('#reference-status')).toContainText(
    '2 window photos loaded',
  );
  await expect(page.locator('#reference-window')).toHaveValue('0:1');
  await page
    .locator('#room-pills')
    .getByRole('button', { name: 'Living room', exact: true })
    .click();
  await page.screenshot({
    path: testInfo.outputPath('window-reference-review.png'),
  });
  await page.getByRole('button', { name: 'Walk through', exact: true }).click();
  await page.getByRole('button', { name: 'Floor plan', exact: true }).click();
  const wait = page.waitForEvent('download');
  await page.locator('#export-model').click();
  const data = await readFile(await (await wait).path());
  const model = JSON.parse(
    data.toString('utf8', 20, 20 + data.readUInt32LE(12)),
  );
  expect(model.nodes.some((n) => n.name?.includes('Window photo'))).toBe(false);
  expect(JSON.stringify(model)).not.toContain('images.example.org');
  await page.reload();
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'References', exact: true }).click();
  await expect(page.locator('#load-reference-images')).toHaveText(
    'Load listing images',
  );
  expect(errors).toEqual([]);
});
test('References panel stays within the sidebar in a narrow desktop window', async ({
  page,
}) => {
  await page.setViewportSize({ width: 880, height: 998 });
  await page.getByRole('button', { name: 'Furnish', exact: true }).click();
  await page.getByRole('button', { name: 'References', exact: true }).click();
  const panel = await page.locator('#references-panel').boundingBox();
  const sidebar = await page.locator('.sidebar').boundingBox();
  expect(panel.x).toBeGreaterThanOrEqual(sidebar.x);
  expect(panel.x + panel.width).toBeLessThanOrEqual(sidebar.x + sidebar.width);
});
test('supplied model geometry is a separate explicit import with provenance', async ({
  page,
}) => {
  const packet = listing();
  packet.layout = {
    project: { ...demo(), id: 'inferred-home', name: 'Inferred example' },
    confidence: 'inferred',
    basis: 'Traced fictional plan; verify every wall.',
  };
  await importListing(page, packet);
  await expect(page.locator('#project-name')).toHaveText('Courtyard House');
  await page.locator('#apply-listing-layout').click();
  await expect(page.locator('#project-name')).toHaveText('Inferred example');
  const snapshot = await downloadProject(page);
  expect(snapshot.project.notes).toContain(
    'Listing layout: inferred. Traced fictional plan; verify every wall.',
  );
});
