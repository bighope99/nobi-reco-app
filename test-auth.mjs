import { chromium } from 'playwright';

async function testAuth() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Checking if user is logged in...');
    await page.goto('http://localhost:3000/dashboard');
    
    // ログインページにリダイレクトされたか確認
    const url = page.url();
    console.log('Current URL after navigating to dashboard:', url);
    
    if (url.includes('/login')) {
      console.log('User is NOT logged in. Need to login first.');
      
      // ログイン処理
      console.log('Filling login form...');
      await page.fill('input[type="email"], input[name="email"], #email', 'sample01@gmail.com');
      await page.fill('input[type="password"], input[name="password"], #password', 'test123');
      
      const submitButton = await page.locator('button[type="submit"]').first();
      console.log('Clicking submit button...');
      await submitButton.click();
      
      // ログイン完了を待機
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      console.log('Login successful! Redirected to dashboard');
      
      // 再度ダッシュボードのURLを確認
      const newUrl = page.url();
      console.log('New URL:', newUrl);
      
      // Cookieを確認
      const cookies = await context.cookies();
      console.log('Cookies count:', cookies.length);
      cookies.forEach(cookie => {
        if (cookie.name.includes('auth') || cookie.name.includes('session')) {
          console.log('Auth cookie found:', cookie.name);
        }
      });
      
    } else {
      console.log('User appears to be logged in already.');
    }
    
    // APIリクエストをテスト
    console.log('Testing API call to /api/dashboard/summary...');
    const response = await page.request.get('http://localhost:3000/api/dashboard/summary');
    console.log('API Response status:', response.status());
    const responseData = await response.json();
    console.log('API Response:', JSON.stringify(responseData, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAuth();
