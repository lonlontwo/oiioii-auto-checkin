/**
 * 導出 Cookies 腳本
 * 用途：登入後導出 Cookies，用於雲端自動化
 * 使用方式：npm run export-cookies
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const USER_DATA_DIR = path.join(__dirname, 'browser-data');
const COOKIES_FILE = path.join(__dirname, 'cookies.json');

async function exportCookies() {
    console.log('🚀 啟動瀏覽器...');

    const browser = await puppeteer.launch({
        headless: false,
        userDataDir: USER_DATA_DIR,
        defaultViewport: { width: 1280, height: 800 },
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled'
        ]
    });

    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('🌐 前往 OiiOii.ai...');
    await page.goto('https://www.oiioii.ai/', { waitUntil: 'networkidle2' });

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  📌 請完成以下步驟：');
    console.log('  1. 如果尚未登入，請點擊登入並選擇 Google 帳號');
    console.log('  2. 確認已登入成功（看到你的頭像和點數）');
    console.log('  3. 回到這裡按 Enter 導出 Cookies');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    await waitForEnter();

    // 導出 Cookies
    console.log('📦 正在導出 Cookies...');
    const cookies = await page.cookies();

    // 也獲取 localStorage
    const localStorage = await page.evaluate(() => {
        const data = {};
        for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            data[key] = window.localStorage.getItem(key);
        }
        return data;
    });

    // 保存到檔案
    const exportData = {
        cookies: cookies,
        localStorage: localStorage,
        exportedAt: new Date().toISOString(),
        url: 'https://www.oiioii.ai/'
    };

    fs.writeFileSync(COOKIES_FILE, JSON.stringify(exportData, null, 2));

    console.log('');
    console.log('✅ Cookies 已導出到: cookies.json');
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  📋 下一步：');
    console.log('  1. 複製 cookies.json 的內容');
    console.log('  2. 到 GitHub 倉庫 → Settings → Secrets');
    console.log('  3. 新增 Secret，名稱：OIIOII_COOKIES');
    console.log('  4. 貼上 cookies.json 的內容');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    // 生成 Base64 版本（方便複製）
    const base64Cookies = Buffer.from(JSON.stringify(exportData)).toString('base64');
    const base64File = path.join(__dirname, 'cookies-base64.txt');
    fs.writeFileSync(base64File, base64Cookies);
    console.log('💡 Base64 版本已保存到: cookies-base64.txt');
    console.log('   (這個版本更適合貼到 GitHub Secrets)');

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

exportCookies().catch(console.error);
