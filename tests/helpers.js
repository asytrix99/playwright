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
 * Adds an invisible box covering the row of `anchor`, from its left edge to the
 * right edge of the viewport, and returns a locator for it to pass to a
 * screenshot `mask`. Useful when content in that row changes width (e.g. counts)
 * and shifts everything after it. The box has pointer-events:none.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} anchor first element of the row
 * @param {string} [id] DOM id for the box (must be unique per mask)
 */
export async function maskRegionFrom(page, anchor, id = 'pw-mask-region') {
  const box = await anchor.boundingBox();
  if (!box) throw new Error('maskRegionFrom: anchor is not visible');

  await page.evaluate(
    ({ box, id }) => {
      document.getElementById(id)?.remove();
      const el = document.createElement('div');
      el.id = id;
      el.style.cssText =
        `position:fixed;left:${box.x}px;top:${box.y}px;right:0;height:${box.height}px;` +
        'pointer-events:none;z-index:2147483647;';
      document.documentElement.appendChild(el);
    },
    { box, id }
  );
  return page.locator(`#${id}`);
}

/**
 * Taps a Flutter (CanvasKit) app at viewport coordinates (x, y) with real mouse
 * input. The semantics layer has full-page "tappable" nodes that swallow clicks,
 * so its pointer events are switched off for the tap and restored afterwards
 * (getByRole(...).click() needs them).
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} x viewport clientX
 * @param {number} y viewport clientY
 */
export async function tapFlutter(page, x, y) {
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.id = 'pw-semantics-click-through';
    style.textContent = 'flt-semantics-host, flt-semantics { pointer-events: none !important; }';
    document.head.appendChild(style);
  });
  try {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.up();
  } finally {
    await page.evaluate(() => document.getElementById('pw-semantics-click-through')?.remove());
  }
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
 * @param {number} intervalMs delay between taps (default 1000, so a retap doesn't close a menu that is still opening)
 */
export async function tapFlutterUntil(page, x, y, targetLocator, timeoutMs = 10000, intervalMs = 1000) {
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
