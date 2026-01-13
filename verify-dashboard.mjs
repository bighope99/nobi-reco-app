import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function verifyDashboard() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('=== Dashboard Verification ===');
    console.log('Navigating to dashboard...');
    
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' });
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);

    // 1. ログイン状態確認
    if (finalUrl.includes('/login')) {
      console.log('STATUS: NOT LOGGED IN - Redirected to login page');
      
      // ログイン実行
      console.log('Attempting login with sample01@gmail.com...');
      
      // フォームを検出
      const emailInput = page.locator('input[type="email"], #email, input[name="email"]').first();
      const passwordInput = page.locator('input[type="password"], #password, input[name="password"]').first();
      const submitBtn = page.locator('button[type="submit"]').first();
      
      await emailInput.fill('sample01@gmail.com');
      await passwordInput.fill('test123');
      await submitBtn.click();
      
      console.log('Login form submitted, waiting for redirect...');
      await page.waitForURL('**/dashboard', { timeout: 15000 });
      await page.waitForLoadState('networkidle');
      
      console.log('Login successful');
    } else {
      console.log('STATUS: ALREADY LOGGED IN');
    }

    // スクリーンショット撮影
    const screenshotPath = path.join(__dirname, 'dashboard-verification.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('Screenshot saved to:', screenshotPath);

    // ページのテキストコンテンツから確認項目をチェック
    const bodyText = await page.textContent('body');
    
    console.log('\n=== Verification Results ===');
    
    // 1. タイムゾーン確認 - 登所ボタンを探す
    const hasCheckInButton = bodyText.includes('登所');
    console.log('1. 登所ボタン存在:', hasCheckInButton ? 'YES' : 'NO');
    
    // 2. エラーメッセージ確認
    const hasError = bodyText.includes('Failed to fetch');
    console.log('2. API エラー発生:', hasError ? 'YES (問題あり)' : 'NO');
    
    // 3. ダッシュボード内容確認
    const hasDashboardContent = bodyText.includes('ダッシュボード') || bodyText.includes('登園') || bodyText.includes('登所') || bodyText.includes('出席');
    console.log('3. ダッシュボード内容表示:', hasDashboardContent ? 'YES' : 'NO');

    // ローカルストレージの確認
    const storage = await context.storageState();
    console.log('\n=== Storage State ===');
    console.log('Cookies:', storage.cookies.length);
    console.log('Local Storage keys:', Object.keys(storage.origins[0]?.localStorage || {}));

    await browser.close();
    console.log('\n=== Verification Complete ===');

  } catch (error) {
    console.error('ERROR:', error.message);
    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }
}

verifyDashboard();
