import { test, expect } from '@playwright/test';
import path from 'path';

test.setTimeout(180 * 1000); // 180 second timeout

test('Activity Record - Class Selection, Mention, and Save Flow', async ({ page }) => {
  const outputDir = path.resolve(__dirname, '../screenshots');
  
  // Create screenshots directory if it doesn't exist
  const fs = require('fs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const getScreenshotPath = (filename: string) => path.join(outputDir, filename);
  
  // Navigate to activity page
  console.log('Navigating to activity page...');
  await page.goto('http://localhost:3000/records/activity', { waitUntil: 'networkidle' });
  
  // Take screenshot 1: Page loaded
  await page.screenshot({ path: getScreenshotPath('test-01-page-loaded.png'), fullPage: true });
  console.log('Screenshot 1: Page loaded');
  
  // Step 1: Select a class
  const classSelect = page.locator('[role="combobox"]').first();
  const isClassVisible = await classSelect.isVisible().catch(() => false);
  console.log('Step 1 - Class select visible:', isClassVisible);
  
  if (isClassVisible) {
    await classSelect.click({ timeout: 5000 });
    await page.waitForTimeout(500);
    
    // Select first class option
    const firstOption = page.locator('[role="option"]').first();
    if (await firstOption.isVisible().catch(() => false)) {
      await firstOption.click({ timeout: 5000 });
      console.log('  Class selected');
      await page.waitForTimeout(800);
    }
  }
  
  // Take screenshot 2: Class selected
  await page.screenshot({ path: getScreenshotPath('test-02-class-selected.png'), fullPage: true });
  console.log('Screenshot 2: Class selected');
  
  // Step 2: Scroll to textarea and interact
  const textarea = page.locator('textarea').first();
  const isTextareaVisible = await textarea.isVisible().catch(() => false);
  console.log('Step 2 - Textarea visible:', isTextareaVisible);
  
  if (isTextareaVisible) {
    // Scroll into view
    await textarea.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    
    // Focus and type using keyboard
    await textarea.focus();
    await page.keyboard.type('@', { delay: 100 });
    console.log('  Typed @ symbol');
    await page.waitForTimeout(1000);
    
    // Check mention picker
    const mentionOptions = await page.locator('[role="option"]').count();
    console.log('  Mention picker options visible:', mentionOptions);
    
    // Wait for dropdown to appear
    await page.waitForTimeout(500);
  }
  
  // Take screenshot 3: Mention dropdown
  await page.screenshot({ path: getScreenshotPath('test-03-mention-dropdown.png'), fullPage: true });
  console.log('Screenshot 3: Mention dropdown shown');
  
  // Step 3: Try to select a child from dropdown
  const firstChildOption = page.locator('[role="option"]').first();
  const optionVisible = await firstChildOption.isVisible().catch(() => false);
  console.log('Step 3 - First option visible:', optionVisible);
  
  if (optionVisible) {
    await firstChildOption.click({ timeout: 5000 }).catch(() => {
      console.log('  Could not click option, continuing...');
    });
    console.log('  Child selection attempted');
    await page.waitForTimeout(500);
  } else {
    // Try alternative: type to filter and press enter
    console.log('  No visible option, trying keyboard navigation');
    await textarea.focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
  }
  
  // Take screenshot 4: Child selected
  await page.screenshot({ path: getScreenshotPath('test-04-child-selected.png'), fullPage: true });
  console.log('Screenshot 4: Child selection attempt complete');
  
  // Step 4: Add more content
  console.log('Step 4 - Adding content to textarea');
  if (isTextareaVisible) {
    await textarea.focus();
    // Clear any existing @ symbol if present
    await page.keyboard.press('End');
    await page.keyboard.type(' テスト記録です', { delay: 30 });
    console.log('  Added content to textarea');
    await page.waitForTimeout(500);
  }
  
  // Take screenshot 5: Content added
  await page.screenshot({ path: getScreenshotPath('test-05-content-added.png'), fullPage: true });
  console.log('Screenshot 5: Content added');
  
  // Step 5: Check save button state
  console.log('Step 5 - Checking save button');
  const saveButton = page.locator('button:has-text("保存")').first();
  const isSaveVisible = await saveButton.isVisible().catch(() => false);
  const isSaveEnabled = await saveButton.isEnabled().catch(() => false);
  console.log('  Save button visible:', isSaveVisible);
  console.log('  Save button enabled:', isSaveEnabled);
  
  // Get button state for debugging
  const buttonClass = await saveButton.getAttribute('class').catch(() => '');
  console.log('  Save button has disabled attr:', buttonClass.includes('disabled'));
  
  // Try to click save button - even if disabled to see what happens
  if (isSaveVisible) {
    try {
      // Don't wait too long, just try to click
      await saveButton.click({ timeout: 3000, force: true });
      console.log('  Clicked save button (forced)');
    } catch (e) {
      console.log('  Save button click failed (expected if disabled):', e.message);
    }
    await page.waitForTimeout(1500);
  }
  
  // Take screenshot 6: After save attempt
  await page.screenshot({ path: getScreenshotPath('test-06-after-save.png'), fullPage: true });
  console.log('Screenshot 6: After save attempt');
  
  console.log('Test completed');
  console.log('Screenshots saved to:', outputDir);
});
