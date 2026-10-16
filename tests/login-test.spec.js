// @ts-check
import { test, expect } from '@playwright/test';
import { maskRegionFrom, tapFlutterUntil } from './helpers';

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
 * @param {number} [delay] ms between keystrokes
 */
async function fillFlutterField(page, label, value, delay = 50) {
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
  await fillFlutterField(page, 'Username', 'ea');
  await fillFlutterField(page, 'Password', 'Password12345678');
  // Tabs render before their counts, which come from the order list's status_count
  const orderList = page.waitForResponse((res) => res.url().includes('/order/getOrderList/') && res.ok());
  await page.getByRole('button', { name: 'LOGIN' }).click();
  await page.waitForURL(/hubOrders\/verification/);
  const { status_count: sc } = await (await orderList).json();

  // Order tabs: label gets " (n)" only when n > 0, using the same sums as tab_by_state.dart
  /** @param {string} name @param {number} count */
  const tabLabel = (name, count) => (count > 0 ? `${name} (${count})` : name);
  const tabs = {
    pending: page.getByRole('button', { name: /^Pending Verification( \(\d+\))?$/ }),
    verified: page.getByRole('button', { name: /^Verified( \(\d+\))?$/ }),
    compounding: page.getByRole('button', { name: /^Compounding( \(\d+\))?$/ }),
  };
  await expect(tabs.pending).toHaveText(tabLabel('Pending Verification', (sc.Pending ?? 0) + (sc.Rejected ?? 0)));
  await expect(tabs.verified).toHaveText(tabLabel('Verified', sc.Approved ?? 0));
  await expect(tabs.compounding).toHaveText(tabLabel('Compounding', (sc.Queue ?? 0) + (sc.Compounding ?? 0)));

  // Search box is visible, usable and starts empty
  const search = page.getByRole('textbox', { name: 'Search by Order No. / Patient Name / Drug Name' });
  await expect(search).toBeVisible();
  await expect(search).toBeEditable();
  await expect(search).toHaveValue('');

  // Table headers: exact set, in order (first column has no header text).
  // The header is its own table; when there are orders, the rows are a second table inside the group.
  const headerTable = page.getByRole('table').filter({ has: page.getByRole('cell', { name: 'Order ID', exact: true }) });
  await expect(headerTable).toBeVisible();
  await expect(headerTable.getByRole('cell')).toHaveText([
    '',
    'Order ID',
    'Route of administration',
    'Preparation Name',
    'Vial Size',
    'Infusion Duration',
    'Patient Details',
    'Treatment Date',
    'Priority',
    'Status',
    'Action',
    'Book',
  ]);

  // Pagination footer: checks the "1–25 of 25" format, not the values
  await expect(page.getByText(/^\d+\s*[–-]\s*\d+ of \d+$/)).toBeVisible();

  // Tab counts change width and shift everything after them, so mask the whole tab row as one strip
  // (from the first tab to the right edge). The tab labels and counts are already asserted above.
  const tabRow = await maskRegionFrom(page, tabs.pending);

  // Sidebar, header, bell and TS bubble have no semantic nodes, so check them visually
  await expect(page).toHaveScreenshot('orders-page.png', {
    mask: [
      tabRow,
      page.getByRole('group'),
      page.getByText(/^\d+\s*[–-]\s*\d+ of \d+$/),
    ],
    maxDiffPixels: 100,
  });

  // Avatar menu has no semantic node (tooltip: "" in menu_screen.dart), so tap it by position.
  // It is anchored to the top-right: 28px right gap + half the ~48px button, 32px top padding + half the button.
  const { width } = /** @type {{ width: number, height: number }} */ (page.viewportSize());
  const logOut = page.getByRole('menuitem', { name: 'Log Out' });
  await tapFlutterUntil(page, width - 28 - 24, 32 + 24, logOut);
  await logOut.click();

  await page.getByRole('button', { name: /CONFIRM/i }).click();

  await page.waitForURL(/\/login/, { timeout: 15000 });
  await expect(page.getByLabel('Username')).toBeVisible({ timeout: 15000 });
});

/** Test that the show-password toggle reveals and re-masks the typed password. */
test('reveal password toggle', async ({ page }) => {
  const eye = page.getByRole('button').filter({ hasNotText: /\S/ });
  const testPassword = 'TestPass123';
  await fillFlutterField(page, 'Password', testPassword);
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
  const loginButton = page.getByRole('button', { name: 'LOGIN' });

  // Attempts 1-5 show the failed-login popup; attempt 6 shows the locked error
  for (let attempt = 1; attempt <= 6; attempt++) {
    await page.reload();
    await enableFlutterAccessibility(page);
    await expect(page).toHaveURL(/login/, { timeout: 5000 });
    await page.getByLabel('Username').waitFor({ state: 'visible', timeout: 30000 });
    await fillFlutterField(page, 'Username', uniqueUsername);
    await fillFlutterField(page, 'Password', 'wrongpassword');
    await loginButton.click();

    if (attempt < 6) {
      await expect(page).toHaveScreenshot('login-failed-popup.png', { maxDiffPixels: 500 });
    } else {
      await expect(page).toHaveScreenshot('account-locked-error.png', {
        mask: [page.getByLabel('Username'), page.getByLabel('Password')],
        maxDiffPixels: 500
      });
    }
  }
});

/** Test that the landing page loads with login form. */
test('landing page', async ({ page }) => {
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'LOGIN' })).toBeVisible();
  await expect(page).toHaveScreenshot('landing-page.png', { maxDiffPixels: 500 });
});