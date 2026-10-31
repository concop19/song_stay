import { expect, test } from '@playwright/test';

test('Sóng Homestay public and admin MVP is ready for the local demo', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('favicon.ico')) {
      browserErrors.push(message.text());
    }
  });

  await page.goto('/');
  await expect(page).toHaveURL(/\/p\/song-homestay$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sóng Homestay — Đà Nẵng' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Các căn đang mở đặt phòng' })).toBeVisible();
  await expect(page.locator('a[href^="/p/song-homestay/stay/"]')).toHaveCount(5);

  await page.goto('/admin/command');
  await expect(page).toHaveURL(/\/admin\/command$/, { timeout: 20_000 });
  const management = page.getByRole('region', { name: 'Quản lý vận hành Sóng Homestay' });
  await expect(management.getByRole('heading', { name: 'Booking thủ công, căn lưu trú và dịch vụ' })).toBeVisible({ timeout: 20_000 });
  await expect(management.getByRole('button', { name: 'Booking ngoài' })).toBeVisible();
  await expect(management.getByText('Booking 30 ngày')).toBeVisible();

  await management.getByRole('button', { name: /Căn \(8\)/ }).click();
  await expect(management.getByRole('button', { name: 'Thêm căn' })).toBeVisible();
  await expect(management.getByText('/phong-a-can-ho-2pn')).toBeVisible();

  await management.getByRole('button', { name: /Dịch vụ \(3\)/ }).click();
  await expect(management.getByRole('button', { name: 'Thêm dịch vụ' })).toBeVisible();
  await expect(management.getByRole('button', { name: 'Lưu' })).toHaveCount(3);

  await expect(page.getByRole('button', { name: 'Đồng bộ ngay' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Đồng bộ lịch iCal (Airbnb / Booking.com) & Kiểm soát Double Booking' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.goto('/admin/operations');
  await expect(page.getByRole('heading', { name: 'Messages & manual refunds' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Booking threads' })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('DEMO_MODE accepts a retained authenticated account without a staff grant', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));

  await page.goto('/admin/login');
  await page.getByRole('button', { name: 'Create account' }).first().click();
  await page.getByLabel('Full name').fill('Tài khoản demo đã lưu');
  await page.getByLabel('Email').fill(`song-retained-${Date.now()}@example.com`);
  await page.getByLabel('Password').fill('SongHomestay-E2E-2026!');
  await page.locator('form').getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/admin(?:\/command)?$/, { timeout: 20_000 });

  await page.goto('/admin/command');
  await expect(page.getByRole('region', { name: 'Quản lý vận hành Sóng Homestay' })).toBeVisible({ timeout: 20_000 });
  expect(browserErrors).toEqual([]);
});

test('provisions an explicitly requested local staff login', async ({ page }) => {
  const email = process.env.OPENSTAYS_CREATE_STAFF_EMAIL;
  const password = process.env.OPENSTAYS_CREATE_STAFF_PASSWORD;
  test.skip(!email || !password, 'Set OPENSTAYS_CREATE_STAFF_EMAIL and OPENSTAYS_CREATE_STAFF_PASSWORD to provision a local login.');

  await page.goto('/admin/login');
  await page.getByRole('button', { name: 'Create account' }).first().click();
  await page.getByLabel('Full name').fill('Quản trị Sóng Homestay');
  await page.getByLabel('Email').fill(email!);
  await page.getByLabel('Password').fill(password!);
  await page.locator('form').getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/admin(?:\/command)?$/, { timeout: 20_000 });
});
