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
