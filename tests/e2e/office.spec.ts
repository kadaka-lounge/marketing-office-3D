import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { OfficeResponse, OfficeState } from '../../src/lib/office/types';

async function readOffice(request: APIRequestContext): Promise<OfficeState> {
  const response = await request.get('/api/office');
  expect(response.ok()).toBeTruthy();
  const result = await response.json() as OfficeResponse;
  return result.state;
}

async function createCampaign(page: Page, request: APIRequestContext, suffix: string) {
  const name = `E2E ${suffix} ${Date.now()}`;
  await page.goto('/');
  await page.getByTestId('new-campaign').click();
  await page.getByTestId('brief-name').fill(name);
  await page.getByTestId('brief-product').fill('Kopi susu Kadaka dengan menu sore untuk komunitas kreatif.');
  await page.getByTestId('brief-audience').fill('Kreator lokal dan profesional muda usia 23–35 tahun.');
  await page.getByTestId('brief-objective').fill('Mengumpulkan minat kunjungan melalui Instagram dan TikTok.');
  // Optional budget and deadline intentionally remain empty.
  await page.getByTestId('brief-submit').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const state = await readOffice(request);
  const campaign = state.campaigns.find(item => item.name === name);
  expect(campaign).toBeDefined();
  expect(campaign!.channels).toEqual(['Instagram', 'TikTok']);
  expect(state.tasks.filter(task => task.campaignId === campaign!.id)).toHaveLength(8);
  await expect(page.getByTestId('campaign-select')).toHaveValue(campaign!.id);
  return campaign!;
}

test('manager creates, revises, approves, and exports a complete demo campaign', async ({ page, request }) => {
  const campaign = await createCampaign(page, request, 'campaign');
  await expect(page.getByRole('combobox', { name: 'Mode eksekusi' })).toHaveValue('demo');
  await page.getByTestId('run-campaign').click();
  await expect.poll(async () => (await readOffice(request)).artifacts.filter(a => a.campaignId === campaign.id).length).toBe(8);
  await page.getByTestId('tab-deliverables').click();
  await expect(page.getByTestId('artifact-card')).toHaveCount(8);

  let state = await readOffice(request);
  const publicationTask = state.tasks.find(task => task.campaignId === campaign.id && task.agentId === 'kai')!;
  const artifact = state.artifacts.find(item => item.taskId === publicationTask.id)!;
  expect(artifact.mode).toBe('demo');
  expect(artifact.content.length).toBeGreaterThan(100);
  expect(state.runs.filter(run => state.tasks.some(task => task.campaignId === campaign.id && task.id === run.taskId))).toHaveLength(8);

  const card = page.locator(`[data-testid="artifact-card"][data-artifact-id="${artifact.id}"]`);
  await card.getByTestId('artifact-select').click();
  await page.getByTestId('artifact-revise').click();
  const feedback = 'Perjelas jadwal konten Instagram dan TikTok untuk minggu pertama.';
  await page.getByTestId('revision-feedback').fill(feedback);
  await page.getByTestId('revision-submit').click();
  await expect.poll(async () => (await readOffice(request)).artifacts.find(item => item.id === artifact.id)?.status).toBe('revision');
  state = await readOffice(request);
  expect(state.messages.some(message => message.taskId === publicationTask.id && message.content.includes(feedback))).toBeTruthy();

  await page.getByTestId('run-campaign').click();
  await expect.poll(async () => (await readOffice(request)).artifacts.find(item => item.taskId === publicationTask.id)?.version).toBeGreaterThan(artifact.version);
  await expect(page.getByTestId('run-campaign')).toBeEnabled();
  for (const row of await page.getByTestId('artifact-card').all()) {
    await row.getByTestId('artifact-approve').click();
    await expect(page.getByTestId('run-campaign')).toBeEnabled();
  }
  await expect.poll(async () => (await readOffice(request)).campaigns.find(item => item.id === campaign.id)?.status).toBe('approved');

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-campaign').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const file = await download.path();
  expect(file).toBeTruthy();
  const contents = await readFile(file!, 'utf8');
  const exported = JSON.parse(contents);
  expect(JSON.stringify(exported)).toContain(campaign.name);
  expect(JSON.stringify(exported)).toContain('Instagram');
  expect(JSON.stringify(exported)).toContain('TikTok');
  expect(JSON.stringify(exported)).toContain(artifact.title);

  await page.reload();
  await page.getByTestId('campaign-select').selectOption(campaign.id);
  await page.getByTestId('tab-deliverables').click();
  await expect(page.getByTestId('artifact-card')).toHaveCount(8);
  state = await readOffice(request);
  expect(state.artifacts.filter(item => item.campaignId === campaign.id).every(item => item.status === 'approved')).toBeTruthy();
  expect(state.publications.filter(item => item.campaignId === campaign.id && item.status === 'published')).toHaveLength(0);
});

test('a manager message creates an assigned task and survives reload', async ({ page, request }) => {
  const campaign = await createCampaign(page, request, 'chat');
  const command = 'Maya, susun tiga ide kolaborasi komunitas untuk kampanye ini.';
  await page.getByTestId('chat-assignee').selectOption('maya');
  await page.getByTestId('chat-input').fill(command);
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-input')).toHaveValue('');
  await expect(page.getByLabel('Pesan grup').getByText(command, { exact: true })).toBeVisible();
  let state = await readOffice(request);
  const assigned = state.tasks.filter(task => task.campaignId === campaign.id && task.agentId === 'maya' && task.instructions.includes(command));
  expect(assigned).toHaveLength(1);
  expect(state.tasks.filter(task => task.campaignId === campaign.id)).toHaveLength(9);
  expect(state.messages.some(message => message.campaignId === campaign.id && message.taskId === assigned[0].id && message.content.includes(command))).toBeTruthy();

  await page.reload();
  await page.getByTestId('campaign-select').selectOption(campaign.id);
  await expect(page.getByLabel('Pesan grup').getByText(command, { exact: true })).toBeVisible();
  await page.getByTestId('tab-workflow').click();
  await expect(page.locator(`[data-testid="task-card"][data-task-id="${assigned[0].id}"]`)).toBeVisible();
  state = await readOffice(request);
  expect(state.tasks.find(task => task.id === assigned[0].id)?.status).toBe('pending');
});

test('the office and navigation remain usable on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByTestId('new-campaign')).toBeVisible();
  await expect(page.getByTestId('chat-input')).toBeVisible();
  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(391);
  await page.getByRole('button', { name: 'Buka navigasi', exact: true }).click();
  await page.getByTestId('tab-workflow').click();
  await expect(page.getByTestId('task-card').first()).toBeVisible();
  await page.getByTestId('new-campaign').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByTestId('brief-name')).toBeVisible();
  await page.getByRole('button', { name: 'Tutup brief', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
