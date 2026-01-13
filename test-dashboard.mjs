import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testDashboard() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // ダッシュボードにアクセス
    console.log('Navigating to dashboard...');
    await page.goto('http://localhost:3000/dashboard');
    
    // ページ読み込み完了を待機
    await page.waitForLoadState('networkidle');
    
    // ログイン状態確認
    const url = page.url();
    console.log('Current URL:', url);
    
    if (url.includes('/login')) {
      console.log('Not logged in. Performing login...');
      
      // ログイン画面でメール入力
      await page.fill('#email', 'sample01@gmail.com');
      await page.fill('#password', 'test123');
      await page.click('button[type="submit"]');
      
      // ダッシュボードへのリダイレクトを待機
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      await page.waitForLoadState('networkidle');
    }
    
    // スクリーンショット撮影（初期状態）
    console.log('Taking screenshot of initial dashboard state...');
    await page.screenshot({ path: path.join(__dirname, 'dashboard-initial.png'), fullPage: true });
    
    // ページのHTML要素を取得
    const title = await page.title();
    console.log('Page title:', title);
    
    // 登所ボタンを探す
    const loginButtons = await page.locator('button:has-text("登所")').all();
    console.log('Found check-in buttons:', loginButtons.length);
    
    // 現在時刻表示を確認
    const timeDisplay = await page.locator('[data-testid="current-time"], .time-display, [class*="time"]').first();
    const hasTimeDisplay = await timeDisplay.isVisible().catch(() => false);
    console.log('Time display visible:', hasTimeDisplay);
    
    console.log('Dashboard verification complete');
    
  } catch (error) {
    console.error('Error during dashboard test:', error);
    await page.screenshot({ path: path.join(__dirname, 'dashboard-error.png') });
  } finally {
    // ブラウザを開いたままにする（手動確認用）
    console.log('Browser will remain open for manual verification. Press Ctrl+C to exit.');
    // await browser.close();
  }
}

testDashboard();
