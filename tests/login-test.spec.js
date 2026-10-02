// @ts-check
import { test, expect } from '@playwright/test';
import { tapFlutter } from './helpers';

const LOGIN_URL = 'https://rxhub.epic-med.link/#/login';

/**
 * Enable Flutter accessibility tree by activating the semantics placeholder.
 * @param {import('@playwright/test').Page} page
 */
async function enableFlutterAccessibility(page) {
  // Flutter injects this placeholder after the CanvasKit/wasm engine boots, waits to attach
  const placeholder = page.locator('flt-semantics-placeholder');
  await placeholder.waitFor({ state: 'attached', timeout: 60000 });
  await placeholder.dispatchEvent('click');
}

/**
 * Types into a Flutter (CanvasKit) text field and verifies the value really
 * landed before returning.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} label
 * @param {string} value
 * @param {number} delay
 */
async function fillFlutterField(page, label, value, delay) {
  const field = page.getByLabel(label);
  await field.waitFor({ state: 'visible', timeout: 30000 });
  await field.click();
  await page.waitForTimeout(100);
  await field.pressSequentially(value, /** @type {any} */({ delay: delay }));

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const el = /** @type {HTMLInputElement | null} */ (document.activeElement);
          return el && 'value' in el ? el.value : null;
        }),
      { timeout: 10000 }
    )
    .toBe(value);
}

test.beforeEach(async ({ page }) => {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await enableFlutterAccessibility(page);
  await page.getByLabel('Username').waitFor({ state: 'visible', timeout: 30000 });
});

/** Test successful login with valid credentials and verify logout works. */
test('valid login', async ({ page }) => {
  await fillFlutterField(page, 'Username', 'ea', 50);
  await fillFlutterField(page, 'Password', 'Password12345678', 50);
  await page.getByRole('button', { name: 'LOGIN' }).click();
  await page.waitForURL(/hubOrders\/verification/);
  await expect(page).toHaveURL(/hubOrders\/verification/);
  await expect(page.getByRole('button', { name: /Pending Verification/ })).toBeVisible();

  // Scale coordinates to current viewport size. Original coords (1231, 52) were on 1280x720.
  const avatarPos = await page.evaluate(() => {
    const originalViewport = { width: 1280, height: 720 };
    const currentViewport = { width: window.innerWidth, height: window.innerHeight };
    const originalCoords = { x: 1231, y: 52 };

    const scaledX = Math.round((originalCoords.x / originalViewport.width) * currentViewport.width);
    const scaledY = Math.round((originalCoords.y / originalViewport.height) * currentViewport.height);

    return { x: scaledX, y: scaledY };
  });
  await tapFlutter(page, avatarPos.x, avatarPos.y);
  await page.getByRole('menuitem', { name: 'Log Out' }).click();

  const confirm = page.getByRole('button', { name: /CONFIRM/i });
  await confirm.waitFor({ state: 'visible', timeout: 10000 });
  await confirm.click();

  await page.waitForURL(/\/login/, { timeout: 15000 });
  await expect(page.getByLabel('Username')).toBeVisible({ timeout: 15000 });
});

/** Test that the show-password toggle reveals and re-masks the typed password. */
test('reveal password toggle', async ({ page }) => {
  const eye = page.getByRole('button').filter({ hasNotText: /\S/ });
  const testPassword = 'TestPass123';
  await fillFlutterField(page, 'Password', testPassword, 50);
  await expect(page).toHaveScreenshot('password-masked.png', { maxDiffPixels: 500 });
  await eye.click();
  await expect(page).toHaveScreenshot('password-visible.png', { maxDiffPixels: 500 });
  await eye.click();
  await expect(page).toHaveScreenshot('password-masked.png', { maxDiffPixels: 500 });
});

/** Test that submitting blank login form shows validation error messages. */
test('blank login', async ({ page }) => {
  await page.getByRole('button', { name: 'LOGIN' }).click();
  await expect(page).toHaveURL(/login/, { timeout: 5000 });
  await expect(page).toHaveScreenshot('blank-login-validation-errors.png', { maxDiffPixels: 500 });
});

/** Test that account locks after multiple failed login attempts. */
test('account lock', async ({ page }) => {
  test.setTimeout(90000);
  const uniqueUsername = `testuser_${Date.now()}`;

  await fillFlutterField(page, 'Username', uniqueUsername, 50);
  await fillFlutterField(page, 'Password', 'wrongpassword', 50);

  const loginButton = page.getByRole('button', { name: 'LOGIN' });

  for (let attempt = 1; attempt <= 5; attempt++) {
    await page.reload();
    await enableFlutterAccessibility(page);
    await expect(page).toHaveURL(/login/, { timeout: 5000 });
    await page.getByLabel('Username').waitFor({ state: 'visible', timeout: 30000 });
    await fillFlutterField(page, 'Username', uniqueUsername, 50);
    await fillFlutterField(page, 'Password', 'wrongpassword', 50);
    await loginButton.click();
    await expect(page).toHaveScreenshot('login-failed-popup.png', { maxDiffPixels: 500 });
  }

  await page.reload();
  await enableFlutterAccessibility(page);
  await expect(page).toHaveURL(/login/, { timeout: 5000 });
  await page.getByLabel('Username').waitFor({ state: 'visible', timeout: 30000 });
  await fillFlutterField(page, 'Username', uniqueUsername, 50);
  await fillFlutterField(page, 'Password', 'wrongpassword', 50);
  await loginButton.click();
  await expect(page).toHaveScreenshot('account-locked-error.png', {
    mask: [page.getByLabel('Username'), page.getByLabel('Password')],
    maxDiffPixels: 500
  });
});