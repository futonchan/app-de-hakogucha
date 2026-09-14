import { expect, test } from '@playwright/test';

test('T-I12 starts, accepts basic controls, pauses, resumes and retries', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('message')).toContainText('アプリでハコグチャ');
  await page.getByTestId('start').tap();
  await expect(page.getByTestId('message')).toContainText('3');
  await expect(page.getByTestId('message')).toBeHidden({ timeout: 4_000 });

  await page.getByTestId('left').tap();
  await page.getByTestId('right').tap();
  await page.getByTestId('punch').tap();
  await expect(page.getByTestId('time')).not.toHaveText('60.0');

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
