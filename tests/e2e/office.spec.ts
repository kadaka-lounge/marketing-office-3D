import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
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

test('backend settings switch endpoint and model without exposing credentials', async ({ page, request }) => {
  await page.goto('/');
  await page.getByTestId('tab-backend').click();
  await page.getByRole('combobox', { name: 'Provider API' }).selectOption('Kustom');
  await page.getByTestId('backend-url').fill('https://provider.example.com/v1');
  await page.getByTestId('backend-model').fill('marketing-test-model');
  await page.getByTestId('backend-save').click();
  await expect(page.getByRole('status').filter({ hasText: 'Konfigurasi backend tersimpan' })).toBeVisible();
  const response = await request.get('/api/office');
  const office = await response.json() as OfficeResponse;
  expect(office.config.aiBaseUrl).toBe('https://provider.example.com/v1');
  expect(office.config.aiModel).toBe('marketing-test-model');
  expect(office.config.aiKeySource).toBe('none');
  expect(office.config.aiConfigured).toBe(false);
  expect(office.config).not.toHaveProperty('apiKey');
  await expect(page.getByTestId('backend-key')).toHaveValue('');
  await expect(page.getByTestId('backend-test')).toBeDisabled();
  await page.reload();
  await page.getByTestId('tab-backend').click();
  await expect(page.getByTestId('backend-url')).toHaveValue('https://provider.example.com/v1');
  await expect(page.getByTestId('backend-model')).toHaveValue('marketing-test-model');
  await page.screenshot({ path: '/tmp/kadaka-backend-api.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  await expect(page.getByTestId('backend-save')).toBeVisible();
});

test('a custom agent uses editable skills in campaign work and manager chat', async ({ page, request }) => {
  test.setTimeout(120_000); // This complete scenario opens the software-rendered 3D scene and profile.
  const campaign = await createCampaign(page, request, 'custom agent');
  const name = `Sora ${Date.now()}`;
  await page.getByTestId('tab-backend').click();
  await page.getByTestId('backend-tab-agents').click();
  await page.getByTestId('agent-name').fill(name);
  await page.getByTestId('agent-role').fill('SEO Specialist');
  await page.getByTestId('agent-instructions').fill('Laporkan asumsi riset kepada Marketing Manager.');
  await page.getByRole('combobox', { name: 'Tambahkan contoh skill' }).selectOption('SEO Content Strategy');
  await page.getByTestId('agent-save').click();
  await expect.poll(async () => (await readOffice(request)).agents.some(a => a.name === name)).toBe(true);
  let state = await readOffice(request);
  const agent = state.agents.find(item => item.name === name)!;
  expect(agent).toBeDefined();
  expect(agent.custom).toBe(true);
  expect(agent.skills?.[0].name).toBe('SEO Content Strategy');
  expect(state.tasks.filter(task => task.campaignId === campaign.id)).toHaveLength(9);
  const row = page.locator(`[data-testid="managed-agent"][data-agent-id="${agent.id}"]`);
  await expect(row).toBeVisible();
  await row.getByTestId('agent-edit').click();
  await page.getByTestId('skill-name-0').fill('SEO Instagram');
  await page.getByTestId('skill-instructions-0').fill('Buat rekomendasi keyword dan caption Instagram tanpa mengarang volume pencarian.');
  await page.getByTestId('agent-save').click();
  await expect(row.getByText('SEO Instagram', { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '/tmp/kadaka-backend-agents.png', fullPage: true });

  await page.getByTestId('run-campaign').click();
  await expect.poll(async () => (await readOffice(request)).artifacts.filter(a => a.campaignId === campaign.id).length).toBe(9);
  state = await readOffice(request);
  const task = state.tasks.find(t => t.campaignId === campaign.id && t.agentId === agent.id)!;
  const artifact = state.artifacts.find(a => a.taskId === task.id)!;
  expect(artifact.content).toContain('SEO Instagram');
  expect(state.messages.some(m => m.senderId === agent.id && m.taskId === task.id)).toBe(true);

  await page.getByTestId('tab-office').click();
  const sceneAgent = page.getByTestId('office-scene').getByRole('button', { name: `${name}, SEO Specialist, Review`, exact: true });
  await expect(sceneAgent).toBeVisible({ timeout: 30_000 });
  await sceneAgent.click();
  await expect(page.getByRole('dialog').getByText('SEO Instagram', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tutup profil', exact: true }).click();
  const command = 'Sora, buat tiga alternatif caption berdasarkan keyword campaign.';
  await page.getByTestId('chat-assignee').selectOption(agent.id);
  await page.getByTestId('chat-input').fill(command);
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-input')).toHaveValue('');
  state = await readOffice(request);
  expect(state.tasks.some(t => t.agentId === agent.id && t.instructions.includes(command))).toBe(true);

  await page.reload();
  await page.getByTestId('tab-backend').click();
  await page.getByTestId('backend-tab-agents').click();
  await expect(row.getByText('SEO Instagram', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
});

test('Ollama settings use a local OpenAI-compatible server without an API key', async ({page,request})=>{
  const calls:{path:string|undefined;authorization:string|undefined;model:string}[]=[];
  const server=createServer(async (req,res)=>{
    if(req.url!=='/v1/chat/completions'){res.writeHead(404);res.end('404 page not found');return;}
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    calls.push({path:req.url,authorization:req.headers.authorization,model:body.model});
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({choices:[{message:{content:'# Hasil server lokal\nOllama-compatible transport verified.'}}]}));
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    await page.goto('/');await page.getByTestId('tab-backend').click();
    await page.getByRole('combobox',{name:'Provider API'}).selectOption('Ollama (lokal)');
    await expect(page.getByTestId('backend-url')).toHaveValue('http://127.0.0.1:11434/v1');
    await expect(page.getByTestId('backend-model')).toHaveValue('qwen2.5:3b');
    await page.getByTestId('backend-url').fill(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/chat`);
    await page.getByTestId('backend-save').click();
    await expect(page.getByTestId('backend-url')).toHaveValue(`http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`);
    await expect(page.getByTestId('backend-test')).toBeEnabled();
    await page.getByTestId('backend-test').click();
    await expect(page.getByRole('status').filter({hasText:'Koneksi berhasil'})).toBeVisible();
    const state=await readOffice(request);const task=state.tasks.find(t=>t.campaignId==='campaign-kadaka'&&t.agentId==='atlas')!;
    const response=await request.post('/api/office/action',{data:{type:'runTask',taskId:task.id,mode:'live'}});
    expect(response.ok()).toBe(true);const result=await response.json() as OfficeResponse;
    expect(result.config).toMatchObject({aiConfigured:true,aiLocal:true,aiKeySource:'none',imageConfigured:false});
    expect(result.state.artifacts.find(a=>a.taskId===task.id)).toMatchObject({mode:'live',content:'# Hasil server lokal\nOllama-compatible transport verified.'});
    expect(calls).toHaveLength(2);expect(calls.every(c=>c.path==='/v1/chat/completions'&&c.model==='qwen2.5:3b'&&c.authorization===undefined)).toBe(true);
    await page.reload();await page.getByTestId('tab-backend').click();
    await expect(page.getByTestId('backend-model')).toHaveValue('qwen2.5:3b');
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('division API settings persist independent encrypted credentials and fit mobile',async({page,request})=>{
 await page.goto('/');await page.getByTestId('tab-backend').click();await page.getByTestId('backend-tab-providers').click();
 for(const provider of ['claude','gemini','openai','meta']){
  await page.getByTestId(`${provider}-enabled`).check();
  await page.getByTestId(`${provider}-key`).fill(`fake-browser-${provider}-key`);
  await page.getByTestId(`${provider}-save`).click();
  await expect(page.getByTestId(`${provider}-key`)).toHaveValue('');
  await expect(page.getByTestId(`provider-${provider}`).getByRole('status')).toContainText('Konfigurasi tersimpan');
 }
 const response=await request.get('/api/office');const office=await response.json() as OfficeResponse;
 expect(office.config.providers.every(p=>p.enabled&&p.configured&&p.keySource==='stored')).toBe(true);
 expect(office.config.meta).toMatchObject({enabled:true,configured:true,keySource:'stored'});
 for(const provider of ['claude','gemini','openai','meta'])expect(JSON.stringify(office)).not.toContain(`fake-browser-${provider}-key`);
 await page.reload();await page.getByTestId('tab-backend').click();await page.getByTestId('backend-tab-providers').click();
 for(const provider of ['claude','gemini','openai','meta']){await expect(page.getByTestId(`${provider}-enabled`)).toBeChecked();await expect(page.getByTestId(`${provider}-key`)).toHaveValue('');await expect(page.getByTestId(`${provider}-test`)).toBeEnabled();}
 await page.screenshot({path:'/tmp/kadaka-division-providers-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await expect.poll(()=>page.locator('.sidebar').evaluate(n=>n.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
 await page.screenshot({path:'/tmp/kadaka-division-providers.png',fullPage:true});
 await page.getByTestId('meta-clear').check();await page.getByTestId('meta-save').click();await expect(page.getByTestId('meta-test')).toBeDisabled();
});

test('Publisher TikTok settings save a private token and expose creator privacy choices',async({page,request})=>{
 await page.goto('/');await page.getByTestId('tab-backend').click();await page.getByTestId('backend-tab-tiktok').click();
 await page.getByTestId('tiktok-enabled').check();await page.getByTestId('tiktok-key').fill('fake-browser-tiktok-token');await page.getByTestId('tiktok-save').click();
 await expect(page.getByTestId('tiktok-key')).toHaveValue('');await expect(page.getByTestId('tiktok-test')).toBeEnabled();
 const response=await request.get('/api/office');const office=await response.json() as OfficeResponse;expect(office.config.tiktok).toMatchObject({enabled:true,configured:true,keySource:'stored'});expect(JSON.stringify(office)).not.toContain('fake-browser-tiktok-token');
 await page.route('**/api/office/tiktok/creator',route=>route.fulfill({json:{ok:true,creator:{creator_username:'browser-test',creator_nickname:'Publisher Browser',privacy_level_options:['SELF_ONLY'],comment_disabled:true,duet_disabled:true,stitch_disabled:true,max_video_post_duration_sec:180}}}));
 await page.getByTestId('tiktok-test').click();await expect(page.getByTestId('tiktok-settings').getByRole('status')).toContainText('@browser-test');
 await page.reload();await page.getByTestId('tab-backend').click();await page.getByTestId('backend-tab-tiktok').click();await expect(page.getByTestId('tiktok-enabled')).toBeChecked();await expect(page.getByTestId('tiktok-key')).toHaveValue('');
 await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.locator('.sidebar').evaluate(n=>n.getBoundingClientRect().right)).toBeLessThanOrEqual(0);await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
 await page.screenshot({path:'/tmp/kadaka-tiktok-settings.png',fullPage:true});
 await page.getByTestId('tiktok-clear').check();await page.getByTestId('tiktok-save').click();await expect(page.getByTestId('tiktok-test')).toBeDisabled();
});

test('TikTok publication requires creator, privacy, and explicit manager consent',async({page,request})=>{
 const brief={name:`TikTok review ${Date.now()}`,product:'Verified product',audience:'Local creators',objective:'Awareness',channels:['TikTok'],budget:'',deadline:''};
 const created=await request.post('/api/office/action',{data:{type:'createCampaign',brief}});expect(created.ok()).toBeTruthy();
 let office=await created.json() as OfficeResponse;const campaign=office.state.campaigns.find(c=>c.name===brief.name)!;
 const run=await request.post('/api/office/action',{data:{type:'runCampaign',campaignId:campaign.id,mode:'demo'}});expect(run.ok()).toBeTruthy();office=await run.json() as OfficeResponse;
 for(const a of office.state.artifacts.filter(a=>a.campaignId===campaign.id)){const r=await request.post('/api/office/action',{data:{type:'approveArtifact',artifactId:a.id}});expect(r.ok()).toBeTruthy();}
 expect((await request.post('/api/office/action',{data:{type:'saveTikTok',settings:{enabled:true,apiKey:'fake-form-tiktok-token'}}})).ok()).toBeTruthy();
 const scheduled=await request.post('/api/office/action',{data:{type:'schedule',campaignId:campaign.id,channels:['TikTok'],scheduledAt:new Date(Date.now()+1000).toISOString()}});expect(scheduled.ok()).toBeTruthy();office=await scheduled.json() as OfficeResponse;
 const publication=office.state.publications.find(p=>p.campaignId===campaign.id)!;
 await page.route('**/api/office/tiktok/creator',route=>route.fulfill({json:{ok:true,creator:{creator_username:'review-account',creator_nickname:'Review Account',privacy_level_options:['SELF_ONLY'],comment_disabled:true,duet_disabled:true,stitch_disabled:true,max_video_post_duration_sec:180}}}));
 let submitted:Record<string,unknown>|undefined;
 await page.route('**/api/office/action',async route=>{const data=route.request().postDataJSON();if(data.type!=='publishTikTok'){await route.continue();return;}submitted=data;const result=structuredClone(office);const p=result.state.publications.find(p=>p.id===publication.id)!;p.status='processing';p.tiktok={attemptedAt:new Date().toISOString(),publishId:'browser-publish-id'};await route.fulfill({json:result});});
 await page.goto('/');await page.getByTestId('campaign-select').selectOption(campaign.id);await page.getByTestId('tab-deliverables').click();
 await page.getByTestId('tiktok-load-creator').click();await expect(page.getByTestId('tiktok-publish-form')).toContainText('@review-account');
 await expect(page.getByTestId('tiktok-privacy')).toHaveValue('');await expect(page.getByTestId('tiktok-submit')).toBeDisabled();
 await page.getByTestId('tiktok-video-url').fill('https://verified.example/final.mp4');await page.getByTestId('tiktok-title').fill('Manager approved caption');await page.getByTestId('tiktok-privacy').selectOption('SELF_ONLY');await expect(page.getByTestId('tiktok-submit')).toBeDisabled();
 await page.getByTestId('tiktok-consent').check();await page.getByTestId('tiktok-submit').click();await expect.poll(()=>submitted?.type).toBe('publishTikTok');expect(submitted).toMatchObject({publicationId:publication.id,title:'Manager approved caption',privacyLevel:'SELF_ONLY',consent:true});
 await expect(page.getByText('Periksa status TikTok',{exact:true})).toBeVisible();
 // Browser fixture only; the server-side native/persistence behavior is tested with mocked TikTok responses in unit tests.
 await request.post('/api/office/action',{data:{type:'saveTikTok',settings:{enabled:false,clearKey:true}}});
});
