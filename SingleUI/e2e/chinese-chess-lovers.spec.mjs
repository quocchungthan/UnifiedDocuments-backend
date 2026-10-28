import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { checkRenderedContrast } from './presentation.mjs';

const room = {
  pairingApproval: 'automatic', code: 'KH2A3B', title: 'Fixture opening', mode: 'ai-vs-ai', game: 1,
  createdAt: Date.now(), status: 'live', settings: { turnSeconds: 300, maxIllegalMoves: 3, maxPlies: 300 }, live: null,
  seats: {
    red: { side: 'red', controller: 'mcp', label: 'Red agent', agentName: 'Fixture Red', model: 'Demo', status: 'connected', lastSeenAt: Date.now(), turnSeenAt: Date.now(), illegalMoves: 0, moves: 0, avgThinkMs: 0, thought: null },
    black: { side: 'black', controller: 'mcp', label: 'Black agent', agentName: 'Fixture Black', model: 'Demo', status: 'connected', lastSeenAt: Date.now(), turnSeenAt: Date.now(), illegalMoves: 0, moves: 0, avgThinkMs: 0, thought: null },
  },
  serverNow: Date.now(), spectators: 4,
  board: { fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1', ascii: '', inCheck: false, activeSide: 'red', ply: 0, legalMoves: ['a3a4'] },
  startedAt: Date.now(), turnStartedAt: Date.now(), deadline: Date.now() + 300000, history: [], events: [], outcome: null,
  insight: { patterns: { phase: 'opening', openings: [] } }, drawOffer: null,
};
const summary = { code: room.code, title: room.title, mode: room.mode, game: room.game, createdAt: room.createdAt, status: room.status,
  seats: room.seats, pairingApproval: room.pairingApproval, spectators: room.spectators, ply: room.board.ply, activeSide: room.board.activeSide };

async function checkNoHorizontalOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function saveVariant(page, stateName, testInfo) {
  const root = process.env.CHESS_SCREENSHOT_DIR;
  if (!root) return;
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const width of [375, 768, 1440]) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.setViewportSize({ width, height: 1000 });
    for (const scheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: scheme });
      await checkNoHorizontalOverflow(page);
      const directory = join(root, stateName);
      await mkdir(directory, { recursive: true });
      if (width !== 768) await page.screenshot({ path: join(directory, `${width}-${scheme}.png`), fullPage: true });
    }
  }
}

test('lobby, scenarios, automatic system themes and visual snapshots', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/?api=substitute');
  await expect(page.getByRole('heading', { name: 'Arena rooms', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Khai cuộc pháo đầu/ })).toBeVisible();
  await expect(page.getByText('Substitute data', { exact: false }).first()).toBeVisible();
  await saveVariant(page, 'lobby-default', testInfo);

  await page.goto('/?api=substitute&scenario=signed-out');
  await expect(page.getByRole('heading', { name: 'Arena rooms', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Khai cuộc pháo đầu/ })).toBeVisible();
  await saveVariant(page, 'lobby-signed-out', testInfo);

  await page.goto('/?api=substitute&scenario=empty');
  await expect(page.getByText('No rooms yet', { exact: true })).toBeVisible();
  await saveVariant(page, 'lobby-empty', testInfo);

  await page.goto('/?api=substitute&scenario=failure');
  await expect(page.getByRole('alert').first()).toContainText('Could not load rooms');
  await expect(page.getByRole('alert').first()).not.toContainText('HTTP 500');
  await saveVariant(page, 'lobby-failure', testInfo);

  await page.goto('/?api=substitute&scenario=loading');
  await expect(page.getByLabel('Loading rooms…')).toBeVisible();
  await saveVariant(page, 'lobby-loading', testInfo);
  expect(errors).toEqual([]);
});

test('skip link focuses the main content without dropping API and scenario query parameters', async ({ page }) => {
  await page.goto('/?api=substitute&scenario=empty');
  await expect(page.getByText('No rooms yet', { exact: true })).toBeVisible();
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await expect(page).toHaveURL('/?api=substitute&scenario=empty');
  await expect(page.getByText('No rooms yet', { exact: true })).toBeVisible();
});

test('room board, player profiles and move history render for a sample room', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/?api=substitute&room=KH2A3B');
  await expect(page.getByRole('heading', { name: 'Khai cuộc pháo đầu' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Players' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Move history' })).toBeVisible();
  await expect(page.getByText('Sample room', { exact: false })).toBeVisible();
  await saveVariant(page, 'room-default', testInfo);
  expect(errors).toEqual([]);
});

test('original 3D board, flip control and keyboard navigation remain available', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/?api=substitute&room=KH2A3B');
  await expect(page.getByRole('button', { name: '3D board', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.board-scene')).toHaveClass(/is-3d/);
  await expect(page.locator('.piece').first()).toHaveAttribute('src', /\/pieces\/[rb][A-Z]\.svg/);
  await page.getByRole('button', { name: '3D board', exact: true }).click();
  await expect(page.locator('.board-scene')).not.toHaveClass(/is-3d/);
  await page.getByRole('button', { name: 'Flip board', exact: true }).click();
  await expect(page.locator('.board-surface')).toHaveClass(/board-surface--flipped/);
  await page.getByRole('button', { name: 'Flip board', exact: true }).click();
  const soldier = page.locator('[data-square="a3"]');
  await soldier.click();
  await expect(soldier).toHaveClass(/is-selected/);
  await page.locator('[data-square="a4"]').click();
  await expect(page.getByText('a3a4', { exact: true })).toBeVisible();
  await expect(page.getByText('To move: Black', { exact: true })).toBeVisible();
  await page.locator('[data-square="e0"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-square="f0"]')).toBeFocused();
  await saveVariant(page, 'board-original', testInfo);
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await checkNoHorizontalOverflow(page);
  }
  expect(errors).toEqual([]);
});

test('live command failures show localized guidance rather than transport errors', async ({ page }) => {
  await page.route('**/api/rooms**', async route => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 500, json: { message: 'private transport detail' } });
    return route.fulfill({ json: { rooms: [] } });
  });
  await page.goto('/?api=live');
  await page.getByLabel('Room name').fill('A room');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  const creationError = page.getByRole('alert');
  await expect(creationError).toHaveText('Could not create the room');
  await expect(creationError).not.toContainText('private transport detail');
});

test('spectator moves never use operator APIs and clipboard failure is reported honestly', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: async () => { throw new Error('Denied'); } },
  }));
  const commands = [];
  page.on('request', request => { if (request.method() === 'POST') commands.push(request.url()); });
  const moveRoom = structuredClone(room);
  moveRoom.seats.red.controller = 'house';
  moveRoom.board = { ...moveRoom.board, fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1', activeSide: 'red', ply: 0, legalMoves: ['a3a4'] };
  moveRoom.history = [];
  moveRoom.startedAt = Date.now();
  await page.route('**/api/rooms/KH2A3B', route => route.fulfill({ json: moveRoom }));
  await page.route('**/api/capabilities', route => route.fulfill({ json: {
    deployment: 'vercel', houseAI: false, audience: false, realtime: 'poll',
  } }));
  await page.goto('/?api=live&room=KH2A3B');
  await expect(page.getByRole('heading', { name: 'Fixture opening' })).toBeVisible();
  await page.locator('[data-square="a3"]').click();
  await expect(page.locator('[data-square="a3"]')).toHaveClass(/is-selected/);
  await expect(page.locator('[data-square="a4"]')).toHaveClass(/is-target/);
  await page.locator('[data-square="a4"]').click();
  const moveError = page.locator('.inline-notice[role=status]');
  await expect(moveError).toHaveText('Could not copy the move. Copy it manually: a3a4');
  await expect(moveError).not.toContainText('private transport detail');
  expect(commands).toEqual([]);
});

test('Vietnamese system language updates product copy and document title', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'vi-VN' });
  const page = await context.newPage();
  await page.goto('/?api=substitute');
  await expect(page.getByRole('heading', { name: 'Danh sách phòng', exact: true })).toBeVisible();
  await expect(page).toHaveTitle('Kỳ Hội');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.getByRole('link', { name: 'Tùy chọn điều hành' }).first()).toHaveAttribute('href', '/admin');
  await expect(page.getByRole('link', { name: 'Luyện tập' })).toHaveCount(0);
  await context.close();
});

test('agent seat reconnect guidance and server-generated prompts use copyable code blocks', async ({ page }, info) => {
  const pairingRoom = structuredClone(room);
  pairingRoom.status = 'open';
  pairingRoom.seats.red.status = 'pairing';
  pairingRoom.seats.black.status = 'disconnected';
  pairingRoom.drawOffer = { id: 'offer', side: 'red', ply: 0, reason: 'Draw guidance' };
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: async text => { window.copiedCode = text; } },
  }));
  await page.route('**/api/capabilities', route => route.fulfill({
    json: { deployment: 'vercel', houseAI: false, audience: false, realtime: 'poll' },
  }));
  await page.route('**/api/rooms/KH2A3B', route => route.fulfill({ json: pairingRoom }));
  const requestedSides = [];
  await page.route('**/api/rooms/KH2A3B/agent-prompt?side=*', route => {
    const side = new URL(route.request().url()).searchParams.get('side');
    requestedSides.push(side);
    return route.fulfill({ json: { prompt: `Server prompt for ${side}\npair_agent then pair_wait; keep agentKey private.` } });
  });
  await page.goto('/room/KH2A3B?api=live');
  const seats = page.locator('chess-seat-panel');
  for (const [index, side] of ['red', 'black'].entries()) {
    const seat = seats.nth(index);
    await seat.getByText('Connect an agent', { exact: true }).click();
    await expect(seat.getByText(/automatically approves a vacant seat/)).toBeVisible();
    if (side === 'black') await expect(seat.getByText(/original agentKey/)).toBeVisible();
    await seat.getByRole('button', { name: 'Agent prompt', exact: true }).click();
    const prompt = seat.locator('emfc-code-block').filter({ hasText: 'Server prompt' });
    await prompt.getByRole('button', { name: 'Copy: Agent prompt', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.copiedCode)).toBe(`Server prompt for ${side}\npair_agent then pair_wait; keep agentKey private.`);
  }
  expect(requestedSides).toEqual(['red', 'black']);
  await expect(page.getByText('The clock is still running; the opponent must accept.')).toBeVisible();
  await saveVariant(page, 'agent-connection', info);
  await page.goto('/room/KH2A3B?api=live&view=obs');
  await expect(page.locator('.app-header')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '3D board' })).toHaveCount(0);
  await expect(page.getByText('Connect an agent', { exact: true })).toHaveCount(0);
});

test('live rooms and room creation use the published routes and payload shape', async ({ page }) => {
  const requests = [];
  await page.route('**/api/rooms**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push({ method: request.method(), path: url.pathname, body: request.method() === 'POST' ? request.postDataJSON() : null });
    if (request.method() === 'POST') return route.fulfill({ status: 201, json: room });
    if (url.pathname === '/api/rooms') return route.fulfill({ json: { rooms: [summary], offset: 0, limit: 50 } });
    return route.fulfill({ json: room });
  });
  await page.goto('/?api=live');
  await expect(page.getByRole('heading', { name: 'Fixture opening' })).toBeVisible();
  await page.getByLabel('Room name').fill('Live fixture room');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect.poll(() => requests.some(item => item.method === 'POST')).toBe(true);
  expect(requests.find(item => item.method === 'POST').body).toEqual({
    title: 'Live fixture room', settings: { turnSeconds: 300 },
  });
  await expect(page).toHaveURL(/\/room\/KH2A3B$/);
  await expect(page.getByRole('heading', { name: /Fixture Red/ })).toBeVisible();
});

const cloudCapabilities = { deployment: 'vercel', houseAI: false, audience: false, realtime: 'poll' };
const nativeConfig = {
  brain: 'offline', defaultModel: null, commentSource: 'mock', tiktokReady: false,
  defaultTikTokUsername: null, defaults: { turnSeconds: 300, aiThinkSeconds: 30 },
  capabilities: cloudCapabilities,
};
const pendingPairing = {
  id: 'a'.repeat(24), code: room.code, side: 'red', agentName: 'Local agent', model: null,
  userCode: 'ABC123', createdAt: Date.now(), expiresAt: Date.now() + 300000, status: 'pending',
};

async function mockOperator(page, config = nativeConfig, currentRoom = structuredClone(room)) {
  const commands = [];
  let pairing = structuredClone(pendingPairing);
  await page.route('**/api/capabilities', route => route.fulfill({ json: config.capabilities }));
  await page.route('**/api/rooms**', route => route.fulfill({ json:
    new URL(route.request().url()).pathname === '/api/rooms' ? { rooms: [summary] } : currentRoom }));
  await page.route('**/admin/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === 'POST') {
      const body = request.postDataJSON();
      commands.push({ path, body });
      if (path.includes('/pairings/')) pairing = { ...pairing, status: body.approve ? 'approved' : 'rejected' };
      if (path.endsWith('/end')) currentRoom.status = 'finished';
      if (path.endsWith('/rematch')) currentRoom.status = 'open';
      if (path.endsWith('/pause')) currentRoom.insight.audience.phase = body.paused ? 'paused' : 'collecting';
      if (path.endsWith('/live')) Object.assign(currentRoom.live, body);
      return route.fulfill({ json: path.includes('/pairings/') ? pairing : path === '/admin/api/rooms' ? currentRoom : { ok: true } });
    }
    const body = path.endsWith('/config') ? config : path.endsWith('/models') ? { models: [{ id: 'native-model', name: 'Native model' }] }
      : path.endsWith('/pairings') ? { pairings: pairing.status === 'pending' ? [pairing] : [] }
      : path.includes('/pairings/') ? pairing : currentRoom;
    return route.fulfill({ json: body });
  });
  return commands;
}

test('operator creation stays live, respects Vercel capabilities and preserves native seat payloads', async ({ page }, info) => {
  const commands = await mockOperator(page);
  await page.goto('/admin?api=substitute');
  await expect(page.getByText(/Authenticated live operator service/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use substitute data', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'AI vs TikTok', exact: true })).toBeDisabled();
  await expect(page.locator('select[name="red-controller"]')).toHaveValue('mcp');
  await expect(page.locator('select[name="red-controller"] option[value="house"]')).toHaveJSProperty('disabled', true);
  await expect(page.locator('select[name="red-model"]')).toBeDisabled();
  const unavailable = page.getByRole('tab', { name: 'AI vs TikTok', exact: true });
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
    await page.mouse.move(0, 0);
    await checkRenderedContrast(unavailable);
    await unavailable.hover();
    await checkRenderedContrast(unavailable);
  }
  await page.getByLabel('Room name').fill('Native operator room');
  await saveVariant(page, 'operator-lobby', info);
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/room\/KH2A3B$/);
  expect(commands[0]).toEqual({ path: '/admin/api/rooms', body: {
    title: 'Native operator room', mode: 'ai-vs-ai',
    seats: { red: { controller: 'mcp' }, black: { controller: 'mcp' } }, settings: { turnSeconds: 300 },
  } });
  await expect(page.getByRole('heading', { name: 'Operator controls', exact: true })).toBeVisible();
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const seats = page.locator('chess-seat-panel');
    const first = await seats.nth(0).boundingBox(), second = await seats.nth(1).boundingBox();
    expect(second.y - first.y - first.height).toBeGreaterThanOrEqual(8);
    await checkNoHorizontalOverflow(page);
  }
  await saveVariant(page, 'operator-room', info);
});

test('operator audience controls and board moves use real commands, confirmations and failure notices', async ({ page }, info) => {
  const liveRoom = structuredClone(room);
  liveRoom.mode = 'ai-vs-audience';
  liveRoom.seats.red.controller = 'house';
  liveRoom.seats.black.controller = 'audience';
  liveRoom.live = { tiktokUsername: null, audienceSeconds: 20, debounceMs: 2000, aiThinkSeconds: 30,
    maxExtensions: 2, earlyCloseVoters: 12, earlyCloseShare: 0.7 };
  liveRoom.insight.audience = {
    connected: true, source: 'mock', phase: 'collecting', windowEndsAt: Date.now() + 30000,
    extensions: 0, audienceSeconds: 20, tally: [], voters: 0, hints: [], recentComments: [],
    commentsPerMinute: 0, lastResolution: null,
  };
  liveRoom.drawOffer = { id: 'b'.repeat(48), side: 'red', ply: 0, reason: 'Native offer' };
  const config = { ...nativeConfig, capabilities: { deployment: 'local', houseAI: true, audience: true, realtime: 'poll' } };
  const commands = await mockOperator(page, config, liveRoom);
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'AI vs TikTok', exact: true }).click();
  await page.getByLabel('TikTok username', { exact: true }).fill('@native-channel');
  await page.getByLabel('Audience side', { exact: true }).selectOption('black');
  await page.getByLabel('Model', { exact: true }).selectOption('native-model');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/room\/KH2A3B$/);
  expect(commands[0].body).toMatchObject({ mode: 'ai-vs-audience',
    seats: { red: { controller: 'house', model: 'native-model' }, black: { controller: 'audience' } },
    settings: { turnSeconds: 300 }, live: { tiktokUsername: 'native-channel', audienceSeconds: 20, debounceMs: 2000, aiThinkSeconds: 30, earlyCloseVoters: 12 },
  });
  await page.getByRole('button', { name: '+5s', exact: true }).click();
  await expect(page.getByText('Voting seconds: 25', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close voting now', exact: true }).click();
  await page.getByText('Test comment', { exact: true }).first().click();
  await page.getByLabel('Test comment', { exact: true }).fill('a3a4');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.locator('[data-square="a3"]').click();
  await page.locator('[data-square="a4"]').click();
  await expect.poll(() => commands.some(command => command.path.endsWith('/move'))).toBe(true);
  expect(commands.find(command => command.path.endsWith('/move')).body).toEqual({ move: 'a3a4' });
  await page.getByRole('button', { name: 'Continue game', exact: true }).click();
  await saveVariant(page, 'operator-audience', info);
  await page.getByText('Manage game and share', { exact: true }).click();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'End game', exact: true }).click();
  expect(commands.some(command => command.path.endsWith('/end'))).toBe(false);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'End game', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rematch', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Rematch', exact: true }).click();
  await expect.poll(() => commands.some(command => command.path.endsWith('/rematch'))).toBe(true);
  expect(commands.find(command => command.path.endsWith('/pause')).body).toEqual({ paused: true });
  expect(commands.find(command => command.path.endsWith('/comments')).body).toEqual({ user: 'operator', text: 'a3a4' });
  expect(commands.find(command => command.path.endsWith('/draw-response')).body).toEqual({ offerId: 'b'.repeat(48), accept: false });
  await page.route('**/admin/api/rooms/KH2A3B/autopilot', route => route.fulfill({ status: 403, json: { error: 'private detail' } }));
  await page.getByRole('button', { name: 'Close voting now', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('operator request failed');
});

test('pairing deep links retain native confirmation, approval and rejection without exposing agent credentials', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'vi-VN' });
  const page = await context.newPage();
  const commands = await mockOperator(page);
  await page.goto(`/admin/pair/${pendingPairing.id}?api=substitute`);
  await expect(page.getByRole('heading', { name: 'Local agent', exact: true })).toBeVisible();
  await expect(page.locator('emfc-code-block code')).toHaveText('ABC123');
  await page.getByRole('button', { name: 'Chấp thuận', exact: true }).click();
  await expect(page.getByText('Đã duyệt', { exact: true })).toBeVisible();
  expect(commands[0]).toEqual({ path: `/admin/api/pairings/${pendingPairing.id}`, body: { approve: true } });
  await mockOperator(page);
  await page.reload();
  await page.getByRole('button', { name: 'Từ chối', exact: true }).click();
  await expect(page.getByText('Đã từ chối', { exact: true })).toBeVisible();
  await page.route('**/admin/api/pairings/*', route => route.fulfill({ status: 410, json: { error: 'Expired' } }));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Yêu cầu điều hành thất bại');
  await context.close();
});
