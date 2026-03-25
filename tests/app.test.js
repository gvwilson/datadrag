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
// Clicks near the top of the block, above the foreignObject control area (y >= 22).
async function clickBlock(page, blockId) {
  const g = page.locator(`[data-block-id="${blockId}"]`);
  const box = await g.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 8);
  await page.mouse.down();
  await page.mouse.up();
}

test('page loads with palette and canvas', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#palette')).toBeVisible();
  await expect(page.locator('#canvas')).toBeVisible();
  for (const label of ['CSV', 'Filter', 'Select', 'Sort', 'Group By', 'Summarize',
                        'Mutate', 'Slice', 'Deduplicate', 'Join', 'Show']) {
    await expect(page.locator('.palette-item', { hasText: label })).toBeVisible();
  }
});

test('drag block from palette creates it on canvas', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Filter', canvas.x + 300, canvas.y + 200);
  await expect(page.locator('[data-block-id]')).toHaveCount(1);
});

test('clicking block shows context menu with type label and delete', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Filter', canvas.x + 300, canvas.y + 200);
  await clickBlock(page, 1);
  await expect(page.locator('#ctx-menu')).not.toHaveClass(/hidden/);
  await expect(page.locator('.menu-item.label')).toHaveText('Filter');
  await expect(page.locator('.menu-item', { hasText: 'Delete' })).toBeVisible();
});

test('every non-show block context menu shows Connect option', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  for (const [i, label] of ['CSV', 'Filter', 'Select', 'Sort', 'Group By',
                              'Summarize', 'Mutate', 'Slice', 'Deduplicate', 'Join'].entries()) {
    await dragFromPalette(page, label, canvas.x + 150 + i * 10, canvas.y + 150 + i * 10);
    await clickBlock(page, i + 1);
    await expect(page.locator('.menu-item', { hasText: 'Connect' })).toBeVisible();
    await page.locator('#palette h2').click(); // close menu
  }
});

test('show block has no Connect option', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Show', canvas.x + 300, canvas.y + 200);
  await clickBlock(page, 1);
  await expect(page.locator('.menu-item', { hasText: 'Connect' })).toHaveCount(0);
});

test('delete removes block from canvas', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Filter', canvas.x + 300, canvas.y + 200);
  await expect(page.locator('[data-block-id]')).toHaveCount(1);
  await clickBlock(page, 1);
  await page.locator('.menu-item', { hasText: 'Delete' }).click();
  await expect(page.locator('[data-block-id]')).toHaveCount(0);
});

test('undo restores deleted block', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Filter', canvas.x + 300, canvas.y + 200);
  await clickBlock(page, 1);
  await page.locator('.menu-item', { hasText: 'Delete' }).click();
  await expect(page.locator('[data-block-id]')).toHaveCount(0);
  await page.mouse.click(canvas.x + 100, canvas.y + 100);
  await page.locator('.menu-item', { hasText: 'Undo' }).click();
  await expect(page.locator('[data-block-id]')).toHaveCount(1);
});

test('connect csv to join creates an arrow', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'CSV',  canvas.x + 150, canvas.y + 200);
  await dragFromPalette(page, 'Join', canvas.x + 450, canvas.y + 200);
  await clickBlock(page, 1);
  await page.locator('.menu-item', { hasText: 'Connect' }).click();
  await clickBlock(page, 2);
  await expect(page.locator('[data-arrow-id]')).toHaveCount(1);
});

test('click connector shows delete option and removes arrow', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'CSV',  canvas.x + 150, canvas.y + 200);
  await dragFromPalette(page, 'Join', canvas.x + 650, canvas.y + 200);
  await clickBlock(page, 1);
  await page.locator('.menu-item', { hasText: 'Connect' }).click();
  await clickBlock(page, 2);
  await expect(page.locator('[data-arrow-id]')).toHaveCount(1);
  await page.locator('[data-arrow-id]').click();
  await expect(page.locator('#ctx-menu')).not.toHaveClass(/hidden/);
  await expect(page.locator('.menu-item.label')).toHaveText('Connector');
  await page.locator('.menu-item', { hasText: 'Delete' }).click();
  await expect(page.locator('[data-arrow-id]')).toHaveCount(0);
});

// --- Knob shape tests ---

test('join block knobs are rendered as polygons (in0, in1, out0)', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Join', canvas.x + 300, canvas.y + 200);
  const block = page.locator('[data-block-id="1"]');
  await expect(block.locator('polygon')).toHaveCount(3);
  await expect(block.locator('circle')).toHaveCount(0);
});

test('csv block out0 knob is rendered as a polygon', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'CSV', canvas.x + 300, canvas.y + 200);
  const block = page.locator('[data-block-id="1"]');
  await expect(block.locator('polygon')).toHaveCount(1);
  await expect(block.locator('circle')).toHaveCount(0);
});

// --- Connection rule tests ---

test('join block accepts connections on both input knobs', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'CSV',  canvas.x + 150, canvas.y + 150);
  await dragFromPalette(page, 'CSV',  canvas.x + 150, canvas.y + 300);
  await dragFromPalette(page, 'Join', canvas.x + 450, canvas.y + 200);
  await clickBlock(page, 1);
  await page.locator('.menu-item', { hasText: 'Connect' }).click();
  await clickBlock(page, 3);
  await expect(page.locator('[data-arrow-id]')).toHaveCount(1);
  await clickBlock(page, 2);
  await page.locator('.menu-item', { hasText: 'Connect' }).click();
  await clickBlock(page, 3);
  await expect(page.locator('[data-arrow-id]')).toHaveCount(2);
});

test('join block rejects a third connection when both knobs are occupied', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'CSV',  canvas.x + 150, canvas.y + 100);
  await dragFromPalette(page, 'CSV',  canvas.x + 150, canvas.y + 250);
  await dragFromPalette(page, 'CSV',  canvas.x + 150, canvas.y + 400);
  await dragFromPalette(page, 'Join', canvas.x + 450, canvas.y + 200);
  for (const id of [1, 2]) {
    await clickBlock(page, id);
    await page.locator('.menu-item', { hasText: 'Connect' }).click();
    await clickBlock(page, 4);
  }
  await expect(page.locator('[data-arrow-id]')).toHaveCount(2);
  // Third attempt silently rejected
  await clickBlock(page, 3);
  await page.locator('.menu-item', { hasText: 'Connect' }).click();
  await clickBlock(page, 4);
  await expect(page.locator('[data-arrow-id]')).toHaveCount(2);
});

test('connecting to a block with no input knobs does nothing', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'CSV',  canvas.x + 150, canvas.y + 200);
  await dragFromPalette(page, 'Show', canvas.x + 450, canvas.y + 200);
  await clickBlock(page, 1);
  await page.locator('.menu-item', { hasText: 'Connect' }).click();
  await clickBlock(page, 2);
  await expect(page.locator('[data-arrow-id]')).toHaveCount(0);
});

test('self-connection attempt is rejected', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'CSV', canvas.x + 300, canvas.y + 200);
  await clickBlock(page, 1);
  await page.locator('.menu-item', { hasText: 'Connect' }).click();
  await clickBlock(page, 1);
  await expect(page.locator('[data-arrow-id]')).toHaveCount(0);
});

// --- Delete cascade ---

test('deleting a block removes its connected arrows', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'CSV',  canvas.x + 150, canvas.y + 200);
  await dragFromPalette(page, 'Join', canvas.x + 450, canvas.y + 200);
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
  await dragFromPalette(page, 'Filter', canvas.x + 300, canvas.y + 200);
  const block = page.locator('[data-block-id="1"]');
  const before = parseTranslate(await block.getAttribute('transform'));
  const box = await block.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + 80);
  await page.mouse.up();
  const after = parseTranslate(await block.getAttribute('transform'));
  expect(after.x).not.toBeCloseTo(before.x, 0);
  expect(after.y).not.toBeCloseTo(before.y, 0);
});

// --- Stack / snap ---

test('csv block snaps above filter when dropped nearby', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  // Filter (id=1) placed first; CSV (id=2) dropped close above it and snaps.
  await dragFromPalette(page, 'Filter', canvas.x + 300, canvas.y + 300);
  await dragFromPalette(page, 'CSV',    canvas.x + 300, canvas.y + 200);
  const filterPos = parseTranslate(await page.locator('[data-block-id="1"]').getAttribute('transform'));
  const csvPos    = parseTranslate(await page.locator('[data-block-id="2"]').getAttribute('transform'));
  // After snap: csv.y + H_WIDE (80) should equal filter.y.
  expect(csvPos.y + 80).toBeCloseTo(filterPos.y, 0);
});

test('dragging the top block in a stack moves the whole chain', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  // Build stack (bottom→top): Show(1) ← Filter(2) ← CSV(3).
  await dragFromPalette(page, 'Show',   canvas.x + 300, canvas.y + 450);
  await dragFromPalette(page, 'Filter', canvas.x + 300, canvas.y + 340);
  await dragFromPalette(page, 'CSV',    canvas.x + 300, canvas.y + 270);
  const showBefore = parseTranslate(await page.locator('[data-block-id="1"]').getAttribute('transform'));
  // Drag CSV (top of stack).
  const csvBlock = page.locator('[data-block-id="3"]');
  const box = await csvBlock.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 100, box.y - 80);
  await page.mouse.up();
  const showAfter = parseTranslate(await page.locator('[data-block-id="1"]').getAttribute('transform'));
  expect(showAfter.x).not.toBeCloseTo(showBefore.x, 0);
  expect(showAfter.y).not.toBeCloseTo(showBefore.y, 0);
});

// --- Undo coverage ---

test('undo after creating an arrow removes it', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'CSV',  canvas.x + 150, canvas.y + 200);
  await dragFromPalette(page, 'Join', canvas.x + 450, canvas.y + 200);
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
  await dragFromPalette(page, 'Filter', canvas.x + 300, canvas.y + 200);
  const block = page.locator('[data-block-id="1"]');
  const original = parseTranslate(await block.getAttribute('transform'));
  const box = await block.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + 80);
  await page.mouse.up();
  await page.mouse.click(canvas.x + 600, canvas.y + 400);
  await page.locator('.menu-item', { hasText: 'Undo' }).click();
  const restored = parseTranslate(await block.getAttribute('transform'));
  expect(restored.x).toBeCloseTo(original.x, 0);
  expect(restored.y).toBeCloseTo(original.y, 0);
});

// --- Block control rendering tests ---

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
  await loadCSV(page, 2, 'tests/test-data-1.csv');

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
  await loadCSV(page, 3, 'tests/test-data-1.csv');

  await page.locator('[data-block-id="3"] button').click();

  await expect(page.locator('#show-modal')).not.toHaveClass(/hidden/);
  await expect(page.locator('#show-body .df-table tbody tr')).toHaveCount(2);
});

test('show modal closes when the close button is clicked', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Show', canvas.x + 300, canvas.y + 300);
  await dragFromPalette(page, 'CSV',  canvas.x + 300, canvas.y + 200);
  await loadCSV(page, 2, 'tests/test-data-1.csv');
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
  await loadCSV(page, 2, 'tests/test-data-1.csv');
  await page.locator('[data-block-id="2"] button').click();
  await expect(page.locator('#show-modal')).not.toHaveClass(/hidden/);

  // Click via evaluate so the overlay element receives the event directly —
  // clicking by coordinates would hit #show-content which sits on top.
  await page.evaluate(() => document.getElementById('show-overlay').click());
  await expect(page.locator('#show-modal')).toHaveClass(/hidden/);
});

// --- Data science block controls ---

test('select block renders a text input', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Select', canvas.x + 300, canvas.y + 200);
  await expect(page.locator('[data-block-id="1"] input[type="text"]')).toHaveCount(1);
});

test('sort block renders a text input', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Sort', canvas.x + 300, canvas.y + 200);
  await expect(page.locator('[data-block-id="1"] input[type="text"]')).toHaveCount(1);
});

test('slice block renders a number input', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Slice', canvas.x + 300, canvas.y + 200);
  await expect(page.locator('[data-block-id="1"] input[type="number"]')).toHaveCount(1);
});

// Stack helper for 3-block tests: Show(1) → Middle(2) → CSV(3), returns CSV block id.
async function threeBlockStack(page, canvas, middleLabel) {
  await dragFromPalette(page, 'Show',       canvas.x + 300, canvas.y + 450);
  await dragFromPalette(page, middleLabel,  canvas.x + 300, canvas.y + 340);
  await dragFromPalette(page, 'CSV',        canvas.x + 300, canvas.y + 270);
}

test('select reduces columns shown in modal', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await threeBlockStack(page, canvas, 'Select');
  // Select only name and color (drop age column) — 2 of 3 columns.
  await page.locator('[data-block-id="2"] input[type="text"]').fill('name, color');
  await loadCSV(page, 3, 'tests/test-data-1.csv');
  await page.locator('[data-block-id="3"] button').click();
  await expect(page.locator('#show-modal')).not.toHaveClass(/hidden/);
  await expect(page.locator('#show-body .df-table th')).toHaveCount(2);
  await expect(page.locator('#show-body .df-table tbody tr')).toHaveCount(4);
});

test('sort orders rows by column value', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await threeBlockStack(page, canvas, 'Sort');
  // Sort by age ascending; Charlie(20) should be first.
  await page.locator('[data-block-id="2"] input[type="text"]').fill('age');
  await loadCSV(page, 3, 'tests/test-data-1.csv');
  await page.locator('[data-block-id="3"] button').click();
  await expect(page.locator('#show-modal')).not.toHaveClass(/hidden/);
  // First column (name) of first row should be Charlie.
  await expect(page.locator('#show-body .df-table tbody tr:first-child td').first()).toHaveText('Charlie');
});

test('sort descending puts largest value first', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await threeBlockStack(page, canvas, 'Sort');
  // Sort by age desc; Diana(35) should be first.
  await page.locator('[data-block-id="2"] input[type="text"]').fill('age desc');
  await loadCSV(page, 3, 'tests/test-data-1.csv');
  await page.locator('[data-block-id="3"] button').click();
  await expect(page.locator('#show-modal')).not.toHaveClass(/hidden/);
  await expect(page.locator('#show-body .df-table tbody tr:first-child td').first()).toHaveText('Diana');
});

test('groupby and summarize produce one row per group', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  // Stack (bottom→top): Show(1), Summarize(2), GroupBy(3), CSV(4).
  await dragFromPalette(page, 'Show',      canvas.x + 300, canvas.y + 580);
  await dragFromPalette(page, 'Summarize', canvas.x + 300, canvas.y + 470);
  await dragFromPalette(page, 'Group By',  canvas.x + 300, canvas.y + 370);
  await dragFromPalette(page, 'CSV',       canvas.x + 300, canvas.y + 290);
  // Group by color: blue(2), red(1), green(1) → 3 groups.
  await page.locator('[data-block-id="3"] input[type="text"]').fill('color');
  await page.locator('[data-block-id="2"] input[type="text"]').fill('n = count()');
  await loadCSV(page, 4, 'tests/test-data-1.csv');
  await page.locator('[data-block-id="4"] button').click();
  await expect(page.locator('#show-modal')).not.toHaveClass(/hidden/);
  await expect(page.locator('#show-body .df-table tbody tr')).toHaveCount(3);
});

test('mutate adds a new column', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await threeBlockStack(page, canvas, 'Mutate');
  // Add a boolean column: senior = age > 29.
  await page.locator('[data-block-id="2"] input[type="text"]').fill('senior = age > 29');
  await loadCSV(page, 3, 'tests/test-data-1.csv');
  await page.locator('[data-block-id="3"] button').click();
  await expect(page.locator('#show-modal')).not.toHaveClass(/hidden/);
  // Original 3 columns + senior = 4 columns, all 4 rows preserved.
  await expect(page.locator('#show-body .df-table th')).toHaveCount(4);
  await expect(page.locator('#show-body .df-table tbody tr')).toHaveCount(4);
});

test('slice keeps only the first N rows', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await threeBlockStack(page, canvas, 'Slice');
  await page.locator('[data-block-id="2"] input[type="number"]').fill('2');
  await loadCSV(page, 3, 'tests/test-data-1.csv');
  await page.locator('[data-block-id="3"] button').click();
  await expect(page.locator('#show-modal')).not.toHaveClass(/hidden/);
  await expect(page.locator('#show-body .df-table tbody tr')).toHaveCount(2);
});

test('deduplicate passes through already-unique rows unchanged', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await threeBlockStack(page, canvas, 'Deduplicate');
  await loadCSV(page, 3, 'tests/test-data-1.csv');
  await page.locator('[data-block-id="3"] button').click();
  await expect(page.locator('#show-modal')).not.toHaveClass(/hidden/);
  await expect(page.locator('#show-body .df-table tbody tr')).toHaveCount(4);
});

// --- Join block ---

test('join block renders a text input for the condition', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Join', canvas.x + 300, canvas.y + 200);
  await expect(page.locator('[data-block-id="1"] input[type="text"]')).toHaveCount(1);
});

test('join block inner-joins two CSV sources and runs when second input arrives', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();

  // Stack: Show(1) at bottom, Join(2) snapped above it.
  await dragFromPalette(page, 'Show', canvas.x + 400, canvas.y + 430);
  await dragFromPalette(page, 'Join', canvas.x + 400, canvas.y + 310);

  // Two CSV blocks placed freely (will not snap to join because join.top = 'flat').
  await dragFromPalette(page, 'CSV', canvas.x + 170, canvas.y + 140); // id=3
  await dragFromPalette(page, 'CSV', canvas.x + 630, canvas.y + 140); // id=4

  // Fill the join condition.
  await page.locator('[data-block-id="2"] input[type="text"]').fill('left.name = right.name');

  // Connect CSV1(3).out0 → Join(2).in0
  await clickBlock(page, 3);
  await page.locator('.menu-item', { hasText: 'Connect' }).click();
  await clickBlock(page, 2); // completes connection to in0

  // Connect CSV2(4).out0 → Join(2).in1
  await clickBlock(page, 4);
  await page.locator('.menu-item', { hasText: 'Connect' }).click();
  await clickBlock(page, 2); // completes connection to in1

  await expect(page.locator('[data-arrow-id]')).toHaveCount(2);

  // Load test-data-1.csv (name,age,color – 4 rows) into CSV1.
  // Load test-data-2.csv (name,score – 3 rows: Alice/Bob/Diana) into CSV2.
  await loadCSV(page, 3, 'tests/test-data-1.csv');
  await loadCSV(page, 4, 'tests/test-data-2.csv');

  // Running CSV1 alone: join has only one input — modal must stay hidden.
  await page.locator('[data-block-id="3"] button').click();
  await expect(page.locator('#show-modal')).toHaveClass(/hidden/);

  // Running CSV2 supplies the second input — join fires automatically.
  await page.locator('[data-block-id="4"] button').click();
  await expect(page.locator('#show-modal')).not.toHaveClass(/hidden/);

  // Inner join: Charlie has no match in test-data-2.csv → 3 rows.
  await expect(page.locator('#show-body .df-table tbody tr')).toHaveCount(3);

  // 'score' column comes from the right table.
  await expect(page.locator('#show-body .df-table th', { hasText: 'score' })).toBeVisible();
});

test('re-running CSV1 after both inputs loaded re-executes join', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Show', canvas.x + 400, canvas.y + 430);
  await dragFromPalette(page, 'Join', canvas.x + 400, canvas.y + 310);
  await dragFromPalette(page, 'CSV', canvas.x + 170, canvas.y + 140); // id=3
  await dragFromPalette(page, 'CSV', canvas.x + 630, canvas.y + 140); // id=4
  await page.locator('[data-block-id="2"] input[type="text"]').fill('left.name = right.name');
  await clickBlock(page, 3);
  await page.locator('.menu-item', { hasText: 'Connect' }).click();
  await clickBlock(page, 2);
  await clickBlock(page, 4);
  await page.locator('.menu-item', { hasText: 'Connect' }).click();
  await clickBlock(page, 2);
  await loadCSV(page, 3, 'tests/test-data-1.csv');
  await loadCSV(page, 4, 'tests/test-data-2.csv');
  // Run both to seed join.
  await page.locator('[data-block-id="4"] button').click();
  await page.locator('[data-block-id="3"] button').click();
  // Modal should be visible after second run (join re-executed).
  await expect(page.locator('#show-modal')).not.toHaveClass(/hidden/);
  await expect(page.locator('#show-body .df-table tbody tr')).toHaveCount(3);
});

// --- Menu behaviour ---

test('context menu closes when clicking outside it', async ({ page }) => {
  await page.goto('/');
  const canvas = await page.locator('#canvas').boundingBox();
  await dragFromPalette(page, 'Filter', canvas.x + 300, canvas.y + 200);
  await clickBlock(page, 1);
  await expect(page.locator('#ctx-menu')).not.toHaveClass(/hidden/);

  // Click the palette heading — no canvas or palette-item handlers, so only hideMenu() fires.
  await page.locator('#palette h2').click();
  await expect(page.locator('#ctx-menu')).toHaveClass(/hidden/);
});
