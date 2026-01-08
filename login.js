/**
 * OiiOii.ai 登入腳本
 * 用途：手動登入 Google 帳號並保存 Session
 * 使用方式：npm run login
 */

const puppeteer = require('puppeteer');
const path = require('path');

// 用戶資料目錄（保存登入狀態）
const USER_DATA_DIR = path.join(__dirname, 'browser-data');

async function login() {
    console.log('🚀 啟動瀏覽器...');
    console.log('📁 用戶資料將保存至:', USER_DATA_DIR);
    
    const browser = await puppeteer.launch({
        headless: false, // 顯示瀏覽器視窗，讓你手動登入
        userDataDir: USER_DATA_DIR, // 保存登入狀態
        defaultViewport: {
            width: 1280,
            height: 800
        },
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled' // 避免被偵測為自動化
        ]
    });

    const page = await browser.newPage();
    
    // 設定 User-Agent，避免被偵測
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('🌐 前往 OiiOii.ai...');
    await page.goto('https://www.oiioii.ai/', { waitUntil: 'networkidle2' });
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  📌 請在瀏覽器中完成以下步驟：');
    console.log('  1. 點擊登入按鈕');
    console.log('  2. 選擇你的 Google 帳號');
    console.log('  3. 完成登入後，確認看到首頁');
    console.log('  4. 回到這裡按 Enter 保存登入狀態');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    
    // 等待用戶按 Enter
    await waitForEnter();
    
    console.log('✅ 登入狀態已保存！');
    console.log('🎉 之後執行 npm run checkin 即可自動簽到');
    
    await browser.close();
}

function waitForEnter() {
    return new Promise((resolve) => {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        rl.question('按 Enter 繼續...', () => {
            rl.close();
            resolve();
        });
    });
}

login().catch(console.error);
