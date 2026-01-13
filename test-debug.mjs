import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testDashboardDebug() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('response', response => {
    console.log(response.status() + ' ' + response.url());
  });

  page.on('console', msg => {
    console.log('BROWSER CONSOLE [' + msg.type() + ']: ' + msg.text());
  });

  page.on('pageerror', error => {
    console.log('PAGE ERROR: ' + error.message);
  });

  try {
    console.log('Navigating to dashboard...');
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ path: path.join(__dirname, 'dashboard-debug.png'), fullPage: true });
    console.log('Debug complete');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    console.log('Browser remains open');
  }
}

testDashboardDebug();
