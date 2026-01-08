/**
 * OiiOii.ai 雲端自動簽到腳本
 * 用途：在 GitHub Actions 等雲端環境執行
 * 使用方式：node checkin-cloud.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

// 從環境變數或檔案讀取 Cookies
function getCookiesData() {
    // 優先從環境變數讀取（GitHub Actions 使用）
    if (process.env.OIIOII_COOKIES) {
        console.log('📦 從環境變數讀取 Cookies...');
        try {
            // 嘗試 Base64 解碼
            const decoded = Buffer.from(process.env.OIIOII_COOKIES, 'base64').toString('utf8');
            return JSON.parse(decoded);
        } catch (e) {
            // 如果不是 Base64，直接解析 JSON
            return JSON.parse(process.env.OIIOII_COOKIES);
        }
    }

    // 從本地檔案讀取（本地測試用）
    const cookiesFile = './cookies.json';
    if (fs.existsSync(cookiesFile)) {
        console.log('📦 從 cookies.json 讀取 Cookies...');
        return JSON.parse(fs.readFileSync(cookiesFile, 'utf8'));
    }

    throw new Error('找不到 Cookies！請先執行 npm run export-cookies');
}

async function checkin() {
    const startTime = new Date();
    console.log(`🚀 [${startTime.toISOString()}] 開始雲端自動簽到...`);

    let browser;
    try {
        const cookiesData = getCookiesData();
        console.log(`📅 Cookies 導出時間: ${cookiesData.exportedAt}`);

        console.log('🌐 啟動無頭瀏覽器...');
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1280,800',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const page = await browser.newPage();

        // 設定 User-Agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // 設定視窗大小
        await page.setViewport({ width: 1280, height: 800 });

        // 注入 Cookies
        console.log('🍪 注入 Cookies...');
        await page.setCookie(...cookiesData.cookies);

        // 前往網站
        console.log('📍 前往 OiiOii.ai...');
        await page.goto('https://www.oiioii.ai/', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // 注入 localStorage
        if (cookiesData.localStorage) {
            console.log('💾 注入 localStorage...');
            await page.evaluate((data) => {
                for (const [key, value] of Object.entries(data)) {
                    window.localStorage.setItem(key, value);
                }
            }, cookiesData.localStorage);

            // 重新載入頁面使 localStorage 生效
            await page.reload({ waitUntil: 'networkidle2' });
        }

        // 等待頁面完全載入
        await new Promise(r => setTimeout(r, 5000));

        // 截圖
        console.log('📸 截取頁面...');
        await page.screenshot({
            path: 'screenshot-before.png',
            fullPage: true
        });

        // 檢查登入狀態
        const pageContent = await page.content();
        const isLoggedIn = pageContent.includes('Free') ||
            pageContent.includes('Point') ||
            pageContent.includes('My Projects');

        if (!isLoggedIn) {
            console.log('⚠️ 可能未登入，嘗試繼續...');
        } else {
            console.log('✅ 已確認登入狀態');
        }

        // 尋找並點擊 Free Points 按鈕
        console.log('🔍 尋找簽到按鈕...');

        // 根據截圖，按鈕在右上角，嘗試多種選擇器
        let clicked = false;

        // 方法 1：尋找包含 "Free" 文字的元素
        try {
            const elements = await page.$$('*');
            for (const element of elements) {
                const text = await page.evaluate(el => el.textContent, element).catch(() => '');
                const tagName = await page.evaluate(el => el.tagName, element).catch(() => '');

                if (text && text.includes('Free') && !text.includes('Freedom') && text.length < 50) {
                    const isClickable = await page.evaluate(el => {
                        const style = window.getComputedStyle(el);
                        return style.cursor === 'pointer' ||
                            el.tagName === 'BUTTON' ||
                            el.tagName === 'A' ||
                            el.onclick !== null;
                    }, element);

                    if (isClickable || tagName === 'BUTTON' || tagName === 'A') {
                        console.log(`  找到元素: ${tagName} - "${text.substring(0, 30)}..."`);
                        await element.click();
                        clicked = true;
                        console.log('✅ 已點擊！');
                        break;
                    }
                }
            }
        } catch (e) {
            console.log(`  搜尋失敗: ${e.message}`);
        }

        // 方法 2：使用 XPath
        if (!clicked) {
            try {
                const [button] = await page.$x("//*[contains(text(), 'Free')]");
                if (button) {
                    await button.click();
                    clicked = true;
                    console.log('✅ 透過 XPath 點擊成功！');
                }
            } catch (e) {
                console.log(`  XPath 失敗: ${e.message}`);
            }
        }

        // 方法 3：點擊右上角區域（備用）
        if (!clicked) {
            console.log('  嘗試點擊右上角區域...');
            try {
                // 點擊頁面右上角（大約是 Free Points 按鈕的位置）
                await page.mouse.click(950, 50);
                await new Promise(r => setTimeout(r, 1000));
                console.log('  已嘗試點擊座標');
            } catch (e) {
                console.log(`  座標點擊失敗: ${e.message}`);
            }
        }

        // 等待動作完成
        await new Promise(r => setTimeout(r, 3000));

        // 最終截圖
        await page.screenshot({
            path: 'screenshot-after.png',
            fullPage: true
        });
        console.log('📸 已保存最終截圖');

        const endTime = new Date();
        const duration = (endTime - startTime) / 1000;
        console.log(`🎉 簽到流程完成！耗時 ${duration.toFixed(1)} 秒`);

        // 輸出結果（供 GitHub Actions 使用）
        if (process.env.GITHUB_OUTPUT) {
            fs.appendFileSync(process.env.GITHUB_OUTPUT, `status=success\n`);
            fs.appendFileSync(process.env.GITHUB_OUTPUT, `clicked=${clicked}\n`);
        }

    } catch (error) {
        console.error(`❌ 錯誤: ${error.message}`);

        if (process.env.GITHUB_OUTPUT) {
            fs.appendFileSync(process.env.GITHUB_OUTPUT, `status=error\n`);
            fs.appendFileSync(process.env.GITHUB_OUTPUT, `error=${error.message}\n`);
        }

        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
            console.log('🔒 瀏覽器已關閉');
        }
    }
}

checkin();
