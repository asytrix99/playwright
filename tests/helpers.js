// @ts-check
// Shared Playwright helpers for the Flutter (CanvasKit) Rx Hub app.

/**
 * Pinpoint the screen coordinates of an element that can't be selected.
 *
 * NOTE: coordinates are tied to the viewport size (this project runs at the
 * Desktop Chrome 1280x720 viewport). If you change the viewport, re-measure.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function logClickCoordinates(page) {
  await page.evaluate(() => {
    const box = document.createElement('div');
    box.style.cssText =
      'position:fixed;top:8px;left:8px;z-index:2147483647;background:#000;color:#0f0;' +
      'font:16px/1.4 monospace;padding:6px 10px;border-radius:4px;pointer-events:none;' +
      'white-space:pre;';
    box.textContent = 'hover an element to read  x / y';
    document.documentElement.appendChild(box);
    /** @param {MouseEvent} e */
    const show = (e) => {
      box.textContent = `x = ${Math.round(e.clientX)}   y = ${Math.round(e.clientY)}`;
    };
    window.addEventListener('mousemove', show, true);
    window.addEventListener('pointerdown', show, true);
  });

  console.log(
    '>>> A black x/y readout box is in the TOP-LEFT of the browser. Hover the target element, read its coordinates, then press Resume (▶).'
  );
  await page.pause();
}

/**
 * Draws a red crosshair dot at (x, y) so you can SEE where the test is about to
 * click. Useful in headed runs to confirm a coordinate click lands on the right
 * element. The dot has pointer-events:none, so it never interferes with the click.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} x
 * @param {number} y
 * @param {string} [label] optional text shown next to the dot
 */
export async function markClickPoint(page, x, y, label = '') {
  await page.evaluate(
    ({ x, y, label }) => {
      const dot = document.createElement('div');
      dot.style.cssText =
        `position:fixed;left:${x}px;top:${y}px;width:18px;height:18px;` +
        'margin:-9px 0 0 -9px;z-index:2147483647;background:rgba(255,0,0,0.6);' +
        'border:2px solid #fff;border-radius:50%;pointer-events:none;' +
        'box-shadow:0 0 0 2px red;';
      if (label) {
        const tag = document.createElement('div');
        tag.textContent = label;
        tag.style.cssText =
          `position:fixed;left:${x + 14}px;top:${y - 8}px;z-index:2147483647;` +
          'background:#000;color:#0f0;font:12px monospace;padding:2px 4px;' +
          'pointer-events:none;white-space:pre;';
        document.documentElement.appendChild(tag);
      }
      document.documentElement.appendChild(dot);
    },
    { x, y, label }
  );
}

/**
 * Taps a Flutter (CanvasKit) app at viewport coordinates (x, y) by dispatching a
 * pointer sequence straight to the glass pane.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} x viewport clientX
 * @param {number} y viewport clientY
 */
export async function tapFlutter(page, x, y) {
  const target = page.locator('flt-glass-pane, flutter-view').first();
  await target.waitFor({ state: 'attached', timeout: 10000 });

  /** @type {Record<string, unknown>} */
  const base = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: x,
    clientY: y,
    screenX: x,
    screenY: y,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    width: 1,
    height: 1,
  };

  await target.dispatchEvent('pointerdown', { ...base, button: 0, buttons: 1, pressure: 0.5 });
  await target.dispatchEvent('pointerup', { ...base, button: 0, buttons: 0, pressure: 0 });
}

/**
 * Taps a Flutter element repeatedly until a target element appears or timeout.
 * Useful when the tap needs retry or the element is slow to respond.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} x viewport clientX
 * @param {number} y viewport clientY
 * @param {import('@playwright/test').Locator} targetLocator element to wait for after taps
 * @param {number} timeoutMs total time to keep tapping (default 10000)
 * @param {number} intervalMs delay between taps (default 500)
 */
export async function tapFlutterUntil(page, x, y, targetLocator, timeoutMs = 10000, intervalMs = 500) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    await tapFlutter(page, x, y);
    await page.waitForTimeout(intervalMs);

    // Check if target appeared
    const isVisible = await targetLocator.isVisible().catch(() => false);
    if (isVisible) {
      console.log(`✓ Target appeared after ${Date.now() - startTime}ms`);
      return true;
    }
  }

  throw new Error(`Target did not appear after ${timeoutMs}ms of repeated taps at (${x}, ${y})`);
}
