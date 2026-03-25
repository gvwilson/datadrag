import { test, expect } from '@playwright/test';

// Helper: drag a palette item onto the canvas at (targetX, targetY) in viewport coords.
async function dragFromPalette(page, label, targetX, targetY) {
  const item = page.locator('.palette-item', { hasText: label });
  const box = await item.boundingBox();
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY);
  await page.mouse.up();
}

// Helper: click a block on canvas to open its context menu (no drag).
async function clickBlock(page, blockId) {
  const g = page.locator(`[data-block-id="${blockId}"]`);
  const box = await g.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.up();
}

test('page loads with palette and canvas', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#palette')).toBeVisible();
  await expect(page.locator('#canvas')).toBeVisible();
  for (const label of ['Input', 'Output', 'Pipeline', 'Fan-in', 'Fan-out']) {
    await expect(page.locator('.palette-item', { hasText: label })).toBeVisible();
  }
});

test('drag block from palette creates it on canvas', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Input', canvas.x + 300, canvas.y + 200);
  await expect(page.locator('[data-block-id]')).toHaveCount(1);
});

test('clicking block shows context menu with type label and delete', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Pipeline', canvas.x + 300, canvas.y + 200);
  await clickBlock(page, 1);
  await expect(page.locator('#ctx-menu')).not.toHaveClass(/hidden/);
  await expect(page.locator('.menu-item.label')).toHaveText('Pipeline');
  await expect(page.locator('.menu-item', { hasText: 'Delete' })).toBeVisible();
});

test('fan-out block context menu shows Connect option', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Fan-out', canvas.x + 300, canvas.y + 200);
  await clickBlock(page, 1);
  await expect(page.locator('.menu-item', { hasText: 'Connect' })).toBeVisible();
});

test('non-connectable block has no Connect option', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Input', canvas.x + 300, canvas.y + 200);
  await clickBlock(page, 1);
  await expect(page.locator('.menu-item', { hasText: 'Connect' })).toHaveCount(0);
});

test('delete removes block from canvas', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Output', canvas.x + 300, canvas.y + 200);
  await expect(page.locator('[data-block-id]')).toHaveCount(1);
  await clickBlock(page, 1);
  await page.locator('.menu-item', { hasText: 'Delete' }).click();
  await expect(page.locator('[data-block-id]')).toHaveCount(0);
});

test('undo restores deleted block', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Input', canvas.x + 300, canvas.y + 200);
  await clickBlock(page, 1);
  await page.locator('.menu-item', { hasText: 'Delete' }).click();
  await expect(page.locator('[data-block-id]')).toHaveCount(0);

  // Click canvas background to get canvas menu, then undo
  await page.mouse.click(canvas.x + 100, canvas.y + 100);
  await page.locator('.menu-item', { hasText: 'Undo' }).click();
  await expect(page.locator('[data-block-id]')).toHaveCount(1);
});

test('connect fan-out to fan-in creates an arrow', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  // Place fan-out on the left, fan-in on the right
  await dragFromPalette(page, 'Fan-out', canvas.x + 150, canvas.y + 200);
  await dragFromPalette(page, 'Fan-in',  canvas.x + 400, canvas.y + 200);

  // Click fan-out to open menu, then click Connect
  await clickBlock(page, 1);
  await page.locator('.menu-item', { hasText: 'Connect' }).click();

  // Click the fan-in block to complete connection
  await clickBlock(page, 2);

  // An arrow group should now exist
  await expect(page.locator('[data-arrow-id]')).toHaveCount(1);
});

test('click connector shows delete option and removes arrow', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Fan-out', canvas.x + 150, canvas.y + 200);
  await dragFromPalette(page, 'Fan-in',  canvas.x + 400, canvas.y + 200);
  await clickBlock(page, 1);
  await page.locator('.menu-item', { hasText: 'Connect' }).click();
  await clickBlock(page, 2);
  await expect(page.locator('[data-arrow-id]')).toHaveCount(1);

  // Click the arrow connector
  await page.locator('[data-arrow-id]').click();
  await expect(page.locator('#ctx-menu')).not.toHaveClass(/hidden/);
  await expect(page.locator('.menu-item.label')).toHaveText('Connector');
  await page.locator('.menu-item', { hasText: 'Delete' }).click();
  await expect(page.locator('[data-arrow-id]')).toHaveCount(0);
});

// --- Knob shape tests (plan-04) ---

test('fan-in knobs are rendered as polygons, not circles', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Fan-in', canvas.x + 300, canvas.y + 200);
  const block = page.locator('[data-block-id="1"]');
  await expect(block.locator('polygon')).toHaveCount(2);
  await expect(block.locator('circle')).toHaveCount(0);
});

test('fan-out knob is rendered as a polygon, not a circle', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Fan-out', canvas.x + 300, canvas.y + 200);
  const block = page.locator('[data-block-id="1"]');
  await expect(block.locator('polygon')).toHaveCount(1);
  await expect(block.locator('circle')).toHaveCount(0);
});

// --- Connection rule tests ---

test('fan-in accepts a second connection on its second knob', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Fan-out', canvas.x + 150, canvas.y + 150);
  await dragFromPalette(page, 'Fan-out', canvas.x + 150, canvas.y + 300);
  await dragFromPalette(page, 'Fan-in',  canvas.x + 400, canvas.y + 200);

  await clickBlock(page, 1);
  await page.locator('.menu-item', { hasText: 'Connect' }).click();
  await clickBlock(page, 3);
  await expect(page.locator('[data-arrow-id]')).toHaveCount(1);

  await clickBlock(page, 2);
  await page.locator('.menu-item', { hasText: 'Connect' }).click();
  await clickBlock(page, 3);
  await expect(page.locator('[data-arrow-id]')).toHaveCount(2);
});

test('fan-in rejects a third connection when both knobs are occupied', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Fan-out', canvas.x + 150, canvas.y + 100);
  await dragFromPalette(page, 'Fan-out', canvas.x + 150, canvas.y + 250);
  await dragFromPalette(page, 'Fan-out', canvas.x + 150, canvas.y + 400);
  await dragFromPalette(page, 'Fan-in',  canvas.x + 400, canvas.y + 200);

  for (const id of [1, 2]) {
    await clickBlock(page, id);
    await page.locator('.menu-item', { hasText: 'Connect' }).click();
    await clickBlock(page, 4);
  }
  await expect(page.locator('[data-arrow-id]')).toHaveCount(2);

  // Third attempt should be silently rejected
  await clickBlock(page, 3);
  await page.locator('.menu-item', { hasText: 'Connect' }).click();
  await clickBlock(page, 4);
  await expect(page.locator('[data-arrow-id]')).toHaveCount(2);
});

test('connecting fan-out to a non-fan-in block does nothing', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Fan-out', canvas.x + 150, canvas.y + 200);
  await dragFromPalette(page, 'Pipeline', canvas.x + 400, canvas.y + 200);

  await clickBlock(page, 1);
  await page.locator('.menu-item', { hasText: 'Connect' }).click();
  await clickBlock(page, 2);
  await expect(page.locator('[data-arrow-id]')).toHaveCount(0);
});

test('self-connection attempt is rejected', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Fan-out', canvas.x + 300, canvas.y + 200);

  await clickBlock(page, 1);
  await page.locator('.menu-item', { hasText: 'Connect' }).click();
  await clickBlock(page, 1); // click the same block
  await expect(page.locator('[data-arrow-id]')).toHaveCount(0);
});

// --- Delete cascade ---

test('deleting a block removes its connected arrows', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Fan-out', canvas.x + 150, canvas.y + 200);
  await dragFromPalette(page, 'Fan-in',  canvas.x + 400, canvas.y + 200);
  await clickBlock(page, 1);
  await page.locator('.menu-item', { hasText: 'Connect' }).click();
  await clickBlock(page, 2);
  await expect(page.locator('[data-arrow-id]')).toHaveCount(1);

  await clickBlock(page, 1);
  await page.locator('.menu-item', { hasText: 'Delete' }).click();
  await expect(page.locator('[data-arrow-id]')).toHaveCount(0);
});

// --- Drag on canvas ---

// Helper: parse SVG translate(x,y) attribute.
function parseTranslate(t) {
  const m = t.match(/translate\(([^,]+),([^)]+)\)/);
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

test('block already on canvas can be dragged to a new position', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Input', canvas.x + 300, canvas.y + 200);
  const block = page.locator('[data-block-id="1"]');
  const before = parseTranslate(await block.getAttribute('transform'));

  const box = await block.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 80);
  await page.mouse.up();

  const after = parseTranslate(await block.getAttribute('transform'));
  expect(after.x).not.toBeCloseTo(before.x, 0);
  expect(after.y).not.toBeCloseTo(before.y, 0);
});

// --- Stack / snap ---

test('fan-in snaps onto fan-out when dropped nearby', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  // Fan-out (id=1) at SVG (240, 220): convex top is the snap target.
  await dragFromPalette(page, 'Fan-out', canvas.x + 300, canvas.y + 250);
  // Fan-in (id=2) at SVG (240, 170): bottom (170+60=230) is within SNAP_DIST=60 of fan-out top (220).
  await dragFromPalette(page, 'Fan-in',  canvas.x + 300, canvas.y + 200);

  const fanoutPos = parseTranslate(await page.locator('[data-block-id="1"]').getAttribute('transform'));
  const faninPos  = parseTranslate(await page.locator('[data-block-id="2"]').getAttribute('transform'));
  // After snap: fan-in.y + H (60) should equal fan-out.y
  expect(faninPos.y + 60).toBeCloseTo(fanoutPos.y, 0);
});

test('dragging the top block in a stack moves the whole chain', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Fan-out', canvas.x + 300, canvas.y + 250);
  await dragFromPalette(page, 'Fan-in',  canvas.x + 300, canvas.y + 200);

  const fanoutBefore = parseTranslate(await page.locator('[data-block-id="1"]').getAttribute('transform'));

  // Drag fan-in (top of stack)
  const faninBlock = page.locator('[data-block-id="2"]');
  const box = await faninBlock.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 100, box.y + box.height / 2 - 80);
  await page.mouse.up();

  const fanoutAfter = parseTranslate(await page.locator('[data-block-id="1"]').getAttribute('transform'));
  expect(fanoutAfter.x).not.toBeCloseTo(fanoutBefore.x, 0);
  expect(fanoutAfter.y).not.toBeCloseTo(fanoutBefore.y, 0);
});

// --- Undo coverage ---

test('undo after creating an arrow removes it', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Fan-out', canvas.x + 150, canvas.y + 200);
  await dragFromPalette(page, 'Fan-in',  canvas.x + 400, canvas.y + 200);
  await clickBlock(page, 1);
  await page.locator('.menu-item', { hasText: 'Connect' }).click();
  await clickBlock(page, 2);
  await expect(page.locator('[data-arrow-id]')).toHaveCount(1);

  await page.mouse.click(canvas.x + 600, canvas.y + 400);
  await page.locator('.menu-item', { hasText: 'Undo' }).click();
  await expect(page.locator('[data-arrow-id]')).toHaveCount(0);
});

test('undo after moving a block restores its position', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Input', canvas.x + 300, canvas.y + 200);
  const block = page.locator('[data-block-id="1"]');
  const original = parseTranslate(await block.getAttribute('transform'));

  // Drag to a new position
  const box = await block.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 80);
  await page.mouse.up();

  await page.mouse.click(canvas.x + 600, canvas.y + 400);
  await page.locator('.menu-item', { hasText: 'Undo' }).click();
  const restored = parseTranslate(await block.getAttribute('transform'));
  expect(restored.x).toBeCloseTo(original.x, 0);
  expect(restored.y).toBeCloseTo(original.y, 0);
});

// --- Plan-05 block type tests ---

test('palette contains csv, filter, and show blocks', async ({ page }) => {
  await page.goto('/');
  for (const label of ['CSV', 'Filter', 'Show']) {
    await expect(page.locator('.palette-item', { hasText: label })).toBeVisible();
  }
});

test('csv block renders a file input and Run button', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'CSV', canvas.x + 300, canvas.y + 200);
  const block = page.locator('[data-block-id="1"]');
  await expect(block.locator('input[type="file"]')).toHaveCount(1);
  await expect(block.locator('button')).toHaveText('Run');
});

test('filter block renders a text input', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Filter', canvas.x + 300, canvas.y + 200);
  await expect(page.locator('[data-block-id="1"] input[type="text"]')).toHaveCount(1);
});

test('show block renders a text input', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Show', canvas.x + 300, canvas.y + 200);
  await expect(page.locator('[data-block-id="1"] input[type="text"]')).toHaveCount(1);
});

test('csv block is wider than a standard block on canvas', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'CSV',   canvas.x + 300, canvas.y + 150);
  await dragFromPalette(page, 'Input', canvas.x + 300, canvas.y + 350);
  // CSV uses W_WIDE=240; Input uses W=120. Check the SVG path d attribute.
  const csvPath   = await page.locator('[data-block-id="1"] path').getAttribute('d');
  const inputPath = await page.locator('[data-block-id="2"] path').getAttribute('d');
  expect(csvPath).toContain('240');
  expect(inputPath).not.toContain('240');
});

test('run without a file loaded shows an alert', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'CSV', canvas.x + 300, canvas.y + 200);
  // Start click without awaiting — alert() blocks the browser, so we must
  // accept the dialog before the click action can complete.
  const dialogPromise = page.waitForEvent('dialog');
  const clickPromise  = page.locator('[data-block-id="1"] button').click();
  const dialog = await dialogPromise;
  expect(dialog.message()).toContain('No CSV file');
  await dialog.accept();
  await clickPromise;
});

// Helper: load a CSV file into a csv block and wait for the async read to finish.
async function loadCSV(page, blockId, filePath) {
  await page.locator(`[data-block-id="${blockId}"] input[type="file"]`).setInputFiles(filePath);
  // The change handler sets the .csv-filename label after file.text() resolves.
  const filename = filePath.split('/').pop();
  await expect(page.locator(`[data-block-id="${blockId}"] .csv-filename`))
    .toHaveText(filename, { timeout: 3000 });
}

test('csv and show stack executes and displays modal with data', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  // Drop Show first (id=1) then CSV above it (id=2); CSV's concave bottom snaps onto Show's convex top.
  // Show SVG y=260, CSV SVG y=160: dy = (160+80)-260 = -20, within SNAP_DIST=60.
  await dragFromPalette(page, 'Show', canvas.x + 300, canvas.y + 300);
  await dragFromPalette(page, 'CSV',  canvas.x + 300, canvas.y + 200);

  await page.locator('[data-block-id="1"] input[type="text"]').fill('My Results');
  await loadCSV(page, 2, 'tests/test-data.csv');

  await page.locator('[data-block-id="2"] button').click();

  await expect(page.locator('#show-modal')).not.toHaveClass(/hidden/);
  await expect(page.locator('#show-title')).toHaveText('My Results');
  await expect(page.locator('#show-body .df-table')).toBeVisible();
  await expect(page.locator('#show-body .df-table tbody tr')).toHaveCount(4);
});

test('filter expression reduces rows shown in modal', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  // Stack (bottom→top): Show(1), Filter(2), CSV(3).
  // Each block snaps onto the one below it.
  await dragFromPalette(page, 'Show',   canvas.x + 300, canvas.y + 450);
  await dragFromPalette(page, 'Filter', canvas.x + 300, canvas.y + 340);
  await dragFromPalette(page, 'CSV',    canvas.x + 300, canvas.y + 270);

  // age > 25 matches Bob(30) and Diana(35) → 2 rows.
  await page.locator('[data-block-id="2"] input[type="text"]').fill('age > 25');
  await loadCSV(page, 3, 'tests/test-data.csv');

  await page.locator('[data-block-id="3"] button').click();

  await expect(page.locator('#show-modal')).not.toHaveClass(/hidden/);
  await expect(page.locator('#show-body .df-table tbody tr')).toHaveCount(2);
});

test('show modal closes when the close button is clicked', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Show', canvas.x + 300, canvas.y + 300);
  await dragFromPalette(page, 'CSV',  canvas.x + 300, canvas.y + 200);
  await loadCSV(page, 2, 'tests/test-data.csv');
  await page.locator('[data-block-id="2"] button').click();
  await expect(page.locator('#show-modal')).not.toHaveClass(/hidden/);

  await page.locator('#show-close').click();
  await expect(page.locator('#show-modal')).toHaveClass(/hidden/);
});

test('show modal closes when the overlay is clicked', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Show', canvas.x + 300, canvas.y + 300);
  await dragFromPalette(page, 'CSV',  canvas.x + 300, canvas.y + 200);
  await loadCSV(page, 2, 'tests/test-data.csv');
  await page.locator('[data-block-id="2"] button').click();
  await expect(page.locator('#show-modal')).not.toHaveClass(/hidden/);

  // Click via evaluate so the overlay element receives the event directly —
  // clicking by coordinates would hit #show-content which sits on top.
  await page.evaluate(() => document.getElementById('show-overlay').click());
  await expect(page.locator('#show-modal')).toHaveClass(/hidden/);
});

// --- Menu behaviour ---

test('context menu closes when clicking outside it', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Input', canvas.x + 300, canvas.y + 200);
  await clickBlock(page, 1);
  await expect(page.locator('#ctx-menu')).not.toHaveClass(/hidden/);

  // Click the palette heading — no canvas or palette-item handlers, so only hideMenu() fires.
  await page.locator('#palette h2').click();
  await expect(page.locator('#ctx-menu')).toHaveClass(/hidden/);
});
