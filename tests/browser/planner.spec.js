import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { demo } from '../helpers.js';
const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const caught = [];
  errors.set(page, caught);
  page.on('pageerror', (error) => caught.push(error.message));
  await page.goto('/');
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true');
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});
async function select(page, id) {
  await page.locator('#furniture-list').selectOption(id);
}
async function edit(page, field, value) {
  await page.locator('#item-' + field).fill(String(value));
  await page.locator('#item-' + field).press('Tab');
}
test('renders the fictional home and all navigation views', async ({
  page,
}) => {
  await expect(page.locator('#item-count')).toHaveText('15');
  if (process.env.UPDATE_DOCS)
    await page.screenshot({ path: 'docs/preview.png', fullPage: true });
  await page.getByRole('button', { name: 'Floor plan', exact: true }).click();
  await expect(page.locator('#view-title')).toHaveText('The floor plan');
  await page
    .locator('#room-pills')
    .getByRole('button', { name: 'Office / guest', exact: true })
    .click();
  await expect(page.locator('#view-title')).toHaveText('Office / guest');
  await page.locator('#scene').press('Escape');
  await expect(page.locator('#view-title')).toHaveText('The whole home');
});
test('checkpoint, reload, reset, undo and redo retain distinct states', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Floor plan', exact: true }).click();
  await page
    .getByRole('button', { name: 'Save checkpoint', exact: true })
    .click();
  await expect(page.locator('#saved')).toHaveText('Matches saved layout');
  await select(page, 'sectional');
  await edit(page, 'x', 24);
  await expect(page.locator('#saved')).toHaveText('Unsaved layout changes');
  await page.reload();
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true');
  await select(page, 'sectional');
  await expect(page.locator('#item-x')).toHaveValue('24.000');
  await page
    .getByRole('button', { name: 'Reset to saved', exact: true })
    .click();
  await expect(page.locator('#view-title')).toHaveText('The floor plan');
  await select(page, 'sectional');
  await expect(page.locator('#item-x')).toHaveValue('21.000');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await select(page, 'sectional');
  await expect(page.locator('#item-x')).toHaveValue('24.000');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await select(page, 'sectional');
  await expect(page.locator('#item-x')).toHaveValue('21.000');
});
test('Murphy deployment and monitor alternatives render', async ({ page }) => {
  await select(page, 'desk-bed');
  await page.getByRole('button', { name: 'Open bed', exact: true }).click();
  await expect(page.locator('#fit-status')).toHaveText(
    'No modeled overlap. Verify real access and clearance.',
  );
  await page.locator('#item-headboardConcept').check();
  await page.getByRole('button', { name: 'Close bed', exact: true }).click();
  await page.getByRole('button', { name: 'Open bed', exact: true }).click();
  await select(page, 'desk');
  await page.locator('#item-monitorLayout').selectOption('quad');
  await page.locator('#item-tvMonitorIn').selectOption('32');
  await page
    .getByRole('button', { name: 'Aim screen for guest', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Aim screen for work', exact: true }),
  ).toBeVisible();
});
test('invalid imports keep the active project intact; text is never interpreted as HTML', async ({
  page,
}) => {
  await page.locator('#import-file').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":9}'),
  });
  await expect(page.locator('#toast')).toContainText('Could not open project');
  await expect(page.locator('#project-name')).toHaveText('Courtyard House');
  const project = demo();
  project.name = '<img src=x onerror=alert(1)>';
  project.id = 'untrusted-text';
  project.items[0].name = '<script>alert(1)</script>';
  await page.locator('#import-file').setInputFiles({
    name: 'project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator('#project-name')).toHaveText(project.name);
  await expect(page.locator('#project-name img')).toHaveCount(0);
  await select(page, 'sectional');
  await expect(page.locator('#selected-name')).toHaveText(
    project.items[0].name,
  );
});
test('JSON and GLB exports are complete portable files', async ({ page }) => {
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  const jsonPromise = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download project JSON', exact: true })
    .click();
  const json = await jsonPromise;
  const snapshot = JSON.parse(await readFile(await json.path(), 'utf8'));
  expect(snapshot.project.items).toHaveLength(15);
  expect(snapshot.project.format).toBe('home-planner');
  const glbPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export 3D', exact: true }).click();
  const glb = await glbPromise;
  const data = await readFile(await glb.path());
  expect(data.toString('ascii', 0, 4)).toBe('glTF');
  expect(data.readUInt32LE(8)).toBe(data.length);
  const jsonLength = data.readUInt32LE(12),
    model = JSON.parse(data.toString('utf8', 20, 20 + jsonLength));
  expect(model.nodes.some((n) => n.extras?.units === 'meters')).toBe(true);
  expect(model.nodes.some((n) => n.name === 'Ceiling')).toBe(true);
  const imagePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save image', exact: true }).click();
  const image = await imagePromise;
  const png = await readFile(await image.path());
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
});
