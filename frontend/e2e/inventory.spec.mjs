import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

const root = fileURLToPath(new URL('../../', import.meta.url));
const screenshotDirectory = fileURLToPath(new URL('../../screenshots/', import.meta.url));
const adminEmail = 'admin@motorline.example';
const memberEmail = 'driver@motorline.example';
const password = `${randomUUID()}aA9!`;
let client, db, server, serverEnv, baseURL, adminToken;
let output = '';

function runNode(args, env) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: { ...process.env, ...env },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });
  return child;
}

async function startServer() {
  server = runNode(['backend/dist/server.js'], serverEnv);
  // Cold process startup can exceed ten seconds on a busy Windows machine.
  // Wait for a real authenticated-route response, with a bounded deadline.
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Backend stopped: ${output}`);
    try {
      if (
        (await fetch(`${baseURL}/api/vehicles`, { signal: AbortSignal.timeout(1000) })).status ===
        401
      )
        return;
    } catch {
      /* Wait until the local HTTP listener is ready. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Backend did not start: ${output}`);
}

async function stopServer() {
  if (server && server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill();
    await exited;
  }
}

async function api(path, { token = adminToken, method = 'GET', body } = {}) {
  return fetch(`${baseURL}/api${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function login(page, email) {
  await page.goto(baseURL);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: email === adminEmail ? 'Your inventory, in view.' : 'Find your next drive.',
    }),
  ).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(6);
}

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  const baseUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/car_dealership_test';
  const uri = new URL(baseUri);
  if (!/^\/[a-zA-Z0-9_]+_test$/.test(uri.pathname))
    throw new Error('TEST_MONGODB_URI must end in _test');
  uri.pathname += `_e2e_${randomUUID().replaceAll('-', '')}`;
  client = await new MongoClient(uri.toString()).connect();
  db = client.db();
  const portServer = createServer();
  portServer.listen(0, '127.0.0.1');
  await once(portServer, 'listening');
  const port = portServer.address().port;
  await new Promise((resolve) => portServer.close(resolve));
  baseURL = `http://127.0.0.1:${port}`;
  serverEnv = {
    MONGODB_URI: uri.toString(),
    JWT_SECRET: randomBytes(32).toString('hex'),
    PORT: String(port),
  };
  const admin = runNode(['backend/dist/create-admin.js'], {
    ...serverEnv,
    ADMIN_EMAIL: adminEmail,
    ADMIN_PASSWORD: password,
  });
  const [exitCode] = await once(admin, 'exit');
  expect(exitCode, output).toBe(0);
  await startServer();
  const loginResponse = await api('/auth/login', {
    token: '',
    method: 'POST',
    body: { email: adminEmail, password },
  });
  expect(loginResponse.status).toBe(200);
  adminToken = (await loginResponse.json()).token;
  for (const vehicle of [
    { make: 'Volvo', model: 'XC60', category: 'SUV', price: 4890000, quantity: 1 },
    { make: 'Toyota', model: 'Camry', category: 'Sedan', price: 3195000, quantity: 5 },
    { make: 'BMW', model: '330i', category: 'Sedan', price: 4550000, quantity: 3 },
    { make: 'Honda', model: 'Civic', category: 'Sedan', price: 2680000, quantity: 0 },
    { make: 'Mazda', model: 'CX-5', category: 'SUV', price: 3375000, quantity: 4 },
    { make: 'Volkswagen', model: 'Golf', category: 'Hatchback', price: 2960000, quantity: 2 },
  ]) {
    expect((await api('/vehicles', { method: 'POST', body: vehicle })).status).toBe(201);
  }
  await mkdir(screenshotDirectory, { recursive: true });
});

test.afterAll(async () => {
  await stopServer();
  // Only this run's random test database is ever dropped.
  if (db) await db.dropDatabase();
  if (client) await client.close();
});

test('regular user registers, searches, purchases and cannot perform admin actions', async ({
  page,
}) => {
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  expect((await api('/vehicles', { token: '' })).status).toBe(401);
  await page.goto(baseURL);
  await page.screenshot({ path: `${screenshotDirectory}/login-desktop.png`, fullPage: true });
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Email address').fill(memberEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(6);
  await expect(page.getByRole('button', { name: 'Add vehicle' })).toHaveCount(0);
  await expect(
    page
      .getByRole('article', { name: 'Honda Civic' })
      .getByRole('button', { name: 'Out of stock' }),
  ).toBeDisabled();
  await page.screenshot({ path: `${screenshotDirectory}/inventory-desktop.png`, fullPage: true });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    if (width === 390)
      await page.screenshot({
        path: `${screenshotDirectory}/inventory-mobile.png`,
        fullPage: true,
      });
  }
  await page.getByLabel('Make', { exact: true }).fill('volvo');
  await page.getByLabel('Model', { exact: true }).fill('xc');
  await page.getByLabel('Category', { exact: true }).fill('suv');
  await page.getByLabel('Min price ($)').fill('40000');
  await page.getByLabel('Max price ($)').fill('48900');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Purchase', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Out of stock' })).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('Purchased one Volvo XC60');
  const member = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('dealership-session')),
  );
  const volvo = await db.collection('vehicles').findOne({ make: 'Volvo' });
  expect(volvo.quantity).toBe(0);
  const path = `/vehicles/${volvo._id}`;
  expect((await api(`${path}/purchase`, { token: member.token, method: 'POST' })).status).toBe(409);
  expect(
    (await api(`${path}/restock`, { token: member.token, method: 'POST', body: { quantity: 1 } }))
      .status,
  ).toBe(403);
  expect((await api(path, { token: member.token, method: 'DELETE' })).status).toBe(403);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await login(page, memberEmail);
  expect(browserErrors).toEqual([]);
});

test('admin adds, edits, restocks, and deletes through the actual UI', async ({ page }) => {
  await login(page, adminEmail);
  await page.screenshot({ path: `${screenshotDirectory}/admin-desktop.png`, fullPage: true });
  await page.getByRole('button', { name: 'Add vehicle' }).click();
  let dialog = page.getByRole('dialog');
  for (const [label, value] of [
    ['Make', 'Lexus'],
    ['Model', 'NX'],
    ['Category', 'SUV'],
    ['Price ($)', '42000.50'],
    ['Quantity in stock', '1'],
  ]) {
    await dialog.getByLabel(label, { exact: true }).fill(value);
  }
  await page.screenshot({ path: `${screenshotDirectory}/admin-form.png` });
  await dialog.getByRole('button', { name: 'Save vehicle' }).click();
  let card = page.getByRole('article', { name: 'Lexus NX', exact: true });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Price ($)')).toHaveValue('42000.50');
  await dialog.getByLabel('Model', { exact: true }).fill('NX 350');
  await dialog.getByRole('button', { name: 'Save vehicle' }).click();
  card = page.getByRole('article', { name: 'Lexus NX 350', exact: true });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Restock', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Quantity to add').fill('3');
  await page.getByRole('dialog').getByRole('button', { name: 'Restock vehicle' }).click();
  await expect(card).toContainText('4 in stock');
  await page.setViewportSize({ width: 390, height: 844 });
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.screenshot({ path: `${screenshotDirectory}/admin-form-mobile.png` });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await card.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete vehicle' }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByRole('article')).toHaveCount(6);
});

test('vehicles and accounts persist after restarting the actual backend process', async () => {
  const input = {
    make: 'Renault',
    model: 'Clio',
    category: 'Hatchback',
    price: 2350000,
    quantity: 2,
  };
  const created = await api('/vehicles', { method: 'POST', body: input });
  expect(created.status).toBe(201);
  const original = await created.json();
  await stopServer();
  await startServer();
  const signedIn = await api('/auth/login', {
    token: '',
    method: 'POST',
    body: { email: adminEmail, password },
  });
  expect(signedIn.status).toBe(200);
  const auth = await signedIn.json();
  const inventory = await (await api('/vehicles', { token: auth.token })).json();
  expect(inventory.find((vehicle) => vehicle.id === original.id)).toEqual({
    ...input,
    id: original.id,
  });
});
