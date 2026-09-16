import { expect, test, type Page } from '@playwright/test';

async function tapDpad(page: Page, direction: 'left' | 'right' | 'up' | 'down'): Promise<void> {
  const box = await page.getByTestId('dpad').boundingBox();
  expect(box).not.toBeNull();
  const points = {
    left: { x: 0.18, y: 0.5 },
    right: { x: 0.82, y: 0.5 },
    up: { x: 0.5, y: 0.18 },
    down: { x: 0.5, y: 0.82 }
  }[direction];
  await page.touchscreen.tap(box!.x + box!.width * points.x, box!.y + box!.height * points.y);
}

test('T-I12 starts, accepts basic controls, pauses, resumes and retries', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('message')).toContainText('アプリでハコグチャ');
  await page.getByTestId('start').tap();
  await expect(page.getByTestId('message')).toContainText('3');
  await expect(page.getByTestId('message')).toBeHidden({ timeout: 4_000 });

  await tapDpad(page, 'up');
  await page.getByTestId('punch').tap();

  await page.getByTestId('pause').tap();
  await expect(page.getByTestId('message')).toContainText('手動ポーズ');
  const pausedTime = await page.getByTestId('time').textContent();
  await page.waitForTimeout(300);
  await expect(page.getByTestId('time')).toHaveText(pausedTime ?? '');

  await page.getByTestId('resume').tap();
  await expect(page.getByTestId('message')).toBeHidden();
  await page.getByTestId('retry').tap();
  await expect(page.getByTestId('message')).toContainText('3');
});

test('T-I11 keeps controls visible on representative portrait sizes', async ({ page }) => {
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 430, height: 932 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByTestId('dpad')).toBeInViewport();
    await expect(page.getByTestId('punch')).toBeInViewport();
    await expect(page.locator('#game-canvas')).toBeInViewport();
  }
});
