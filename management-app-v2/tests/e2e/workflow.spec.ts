import { mkdirSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { services } from '../../lib/server';
import { clearWorkspace, password, seed } from '../emulator';
import { fixture } from '../fixture';

test.describe.configure({ mode: 'serial' });
mkdirSync('evidence', { recursive: true });

async function login(page: Page, who: string) {
  await page.goto('/');
  await page.getByLabel('Email address').fill(`${who}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
}

async function createInitiative(page: Page) {
  await page.getByRole('button', { name: '+ New initiative', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Create initiative' });
  await dialog.getByLabel('Owner').selectOption('alice');
  await dialog.getByLabel('Initiative', { exact: true }).fill('Improve customer experience');
  await dialog.getByLabel('What outcome are we trying to achieve?').fill('Make every customer handoff clear, fast, and measurable.');
  await dialog.getByLabel('KPI name').fill('Follow-ups within 24 hours');
  await dialog.getByLabel('Current').fill('75');
  await dialog.getByLabel('Target').fill('95');
  await dialog.getByLabel('Unit').fill('%');
  await dialog.getByRole('button', { name: 'Create initiative', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Improve customer experience' })).toBeVisible();
}

async function openInitiative(page: Page, title: string) {
  const existing = page.getByRole('heading', { level: 1, name: title });
  if (await existing.isVisible().catch(() => false)) return;
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Initiatives', exact: true }).click();
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).click();
  await expect(existing).toBeVisible();
}

test('first-time administrator can activate, verify email, and bootstrap the workspace', async ({ page }) => {
  await clearWorkspace();
  await page.goto('/');
  await page.getByRole('button', { name: 'First time here? Activate account' }).click();
  await page.getByLabel('Full name').fill('Avery Admin');
  await page.getByLabel('Email address').fill('admin@example.test');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
  const created = await services().auth.getUserByEmail('admin@example.test');
  await services().auth.updateUser(created.uid, { emailVerified: true });
  await page.getByRole('button', { name: 'Check access again', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: /What needs attention/ })).toBeVisible();
});

test('manager assigns KPI-backed work and employee-manager communication stays with the initiative', async ({ browser }) => {
  await seed(fixture());
  const errors: string[] = [];
  const managerContext = await browser.newContext();
  const manager = await managerContext.newPage();
  manager.on('pageerror', e => errors.push(e.message));
  await login(manager, 'manager');
  await createInitiative(manager);

  await manager.getByRole('button', { name: '+ Add KPI', exact: true }).click();
  let dialog = manager.getByRole('dialog', { name: 'Add KPI' });
  await dialog.getByLabel('KPI name').fill('Customer check-ins');
  await dialog.getByLabel('Target').fill('12');
  await dialog.getByLabel('Unit').fill('per month');
  await dialog.getByRole('button', { name: 'Add KPI', exact: true }).click();
  await expect(manager.getByRole('heading', { name: 'Customer check-ins', exact: true })).toBeVisible();

  const employeeContext = await browser.newContext();
  const employee = await employeeContext.newPage();
  employee.on('pageerror', e => errors.push(e.message));
  await login(employee, 'alice');
  await openInitiative(employee, 'Improve customer experience');
  const firstKpi = employee.locator('.kpi-card').filter({ hasText: 'Follow-ups within 24 hours' });
  await firstKpi.getByRole('button', { name: 'Update KPI' }).click();
  dialog = employee.getByRole('dialog', { name: /Update Follow-ups within 24 hours/ });
  await dialog.getByLabel('Current value').fill('82');
  await dialog.getByLabel('Status').selectOption('at_risk');
  await dialog.getByLabel('Update note').fill('The duplicate approval step is slowing handoffs.');
  await dialog.getByRole('button', { name: 'Save update' }).click();

  await employee.getByLabel('Message').fill('Can we simplify the handoff from sales to operations?');
  await employee.getByRole('button', { name: 'Send message' }).click();
  await expect(employee.getByText('Can we simplify the handoff from sales to operations?', { exact: true })).toBeVisible();

  await manager.reload();
  await openInitiative(manager, 'Improve customer experience');
  await expect(manager.getByText('The duplicate approval step is slowing handoffs.', { exact: false })).toBeVisible();
  await expect(manager.getByText('Can we simplify the handoff from sales to operations?', { exact: true })).toBeVisible();
  await manager.getByLabel('Message').fill('Yes. I will remove the duplicate approval step today.');
  await manager.getByRole('button', { name: 'Send message' }).click();

  await employee.reload();
  await openInitiative(employee, 'Improve customer experience');
  await expect(employee.getByText('Yes. I will remove the duplicate approval step today.', { exact: true })).toBeVisible();
  await employee.setViewportSize({ width: 390, height: 844 });
  await employee.screenshot({ path: 'evidence/v2-employee-mobile.png', fullPage: true });
  expect(await employee.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  admin.on('pageerror', e => errors.push(e.message));
  await login(admin, 'admin');
  await admin.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'My team', exact: true }).click();
  await expect(admin.getByRole('heading', { name: 'Morgan Manager', exact: true })).toBeVisible();
  await expect(admin.getByText('Alice Employee', { exact: true }).first()).toBeVisible();
  await admin.screenshot({ path: 'evidence/v2-admin-hierarchy.png', fullPage: true });

  expect(errors).toEqual([]);
  await managerContext.close();
  await employeeContext.close();
  await adminContext.close();
});

test('peer employee cannot see another employee initiative or conversation', async ({ page }) => {
  await seed(fixture());
  await login(page, 'bob');
  await expect(page.getByText('Grow qualified pipeline', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Alice Employee', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Let’s keep this focused on qualified opportunities, not raw lead volume.', { exact: true })).toHaveCount(0);
});
