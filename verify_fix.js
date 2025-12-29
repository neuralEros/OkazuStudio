
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Set viewport to see toolbar and modal
  await page.setViewportSize({ width: 1280, height: 720 });
  
  const filePath = path.resolve(__dirname, 'index.html');
  await page.goto(`file://${filePath}`);
  
  // Locate the save button in the top right to compare
  const saveBtn = page.locator('#saveBtn');
  // Trigger a modal
  await page.evaluate(() => {
    window.showModal('Comparison Check.', {
      title: 'Test Title',
      choices: [{ label: 'Action', value: 'action' }]
    });
  });
  const modal = page.locator('#modal-overlay');
  await expect(modal).toBeVisible();
  
  // Wait a moment for transitions
  await page.waitForTimeout(500);

  await page.screenshot({ path: '/home/jules/verification/fix_check.png' });
  console.log("Screenshot generated.");
  
  await browser.close();
})();

async function expect(locator) {
  const count = await locator.count();
  if (count === 0) throw new Error("Element not found");
  const visible = await locator.isVisible();
  if (!visible) throw new Error("Element not visible");
}
