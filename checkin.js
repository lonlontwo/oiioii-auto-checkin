/**
 * OiiOii.ai 自動簽到腳本
 * 用途：每日自動點擊領取 300 免費點數
 * 使用方式：npm run checkin
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// 配置
const CONFIG = {
    USER_DATA_DIR: path.join(__dirname, 'browser-data'),
    OIIOII_URL: 'https://www.oiioii.ai/',
    LOG_FILE: path.join(__dirname, 'checkin-log.txt'),
    TIMEOUT: 30000, // 30 秒超時
};

// 日誌函數
function log(message) {
    const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);

    // 寫入日誌檔案
    fs.appendFileSync(CONFIG.LOG_FILE, logMessage + '\n');
}

async function checkin() {
    log('🚀 開始自動簽到...');

    // 檢查是否已登入過
    if (!fs.existsSync(CONFIG.USER_DATA_DIR)) {
        log('❌ 錯誤：尚未登入！請先執行 npm run login');
        process.exit(1);
    }

    let browser;
    try {
        log('🌐 啟動瀏覽器...');
        browser = await puppeteer.launch({
            headless: 'new', // 無頭模式（背景執行）
            userDataDir: CONFIG.USER_DATA_DIR,
            defaultViewport: {
                width: 1280,
                height: 800
            },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const page = await browser.newPage();

        // 設定 User-Agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        log('📍 前往 OiiOii.ai...');
        await page.goto(CONFIG.OIIOII_URL, {
            waitUntil: 'networkidle2',
            timeout: CONFIG.TIMEOUT
        });

        // 等待頁面載入
        await page.waitForTimeout(3000);

        // 檢查是否已登入（尋找用戶頭像或點數顯示）
        log('🔍 檢查登入狀態...');

        // 截圖用於調試
        const screenshotPath = path.join(__dirname, 'debug-screenshot.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        log(`📸 已截圖: ${screenshotPath}`);

        // 尋找並點擊 Free Points 按鈕
        // 根據截圖，按鈕在右上角，可能包含 "Free Points" 或點數數字
        log('🔍 尋找簽到按鈕...');

        // 嘗試多種選擇器
        const possibleSelectors = [
            '[class*="point"]',
            '[class*="Point"]',
            '[class*="free"]',
            '[class*="Free"]',
            '[class*="credit"]',
            '[class*="Credit"]',
            'button:has-text("Free")',
            'div:has-text("Free Points")',
            // 右上角區域
            'header button',
            'nav button',
        ];

        let clicked = false;

        for (const selector of possibleSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const text = await page.evaluate(el => el.textContent, element);
                    log(`  找到元素: ${selector} - 內容: ${text?.substring(0, 50)}`);

                    if (text && (text.includes('Free') || text.includes('Point') || /\d+/.test(text))) {
                        await element.click();
                        log(`✅ 已點擊: ${selector}`);
                        clicked = true;
                        break;
                    }
                }
            } catch (e) {
                // 選擇器不匹配，繼續嘗試
            }
        }

        if (!clicked) {
            // 使用 XPath 尋找包含 "Free" 的元素
            log('🔍 使用 XPath 尋找...');
            try {
                const [freePointsButton] = await page.$x("//*[contains(text(), 'Free')]");
                if (freePointsButton) {
                    await freePointsButton.click();
                    log('✅ 已透過 XPath 點擊 Free Points 按鈕');
                    clicked = true;
                }
            } catch (e) {
                log(`  XPath 搜尋失敗: ${e.message}`);
            }
        }

        if (!clicked) {
            log('⚠️ 未找到簽到按鈕，可能需要手動檢查');
            log('   請查看 debug-screenshot.png 確認頁面狀態');
        }

        // 等待動作完成
        await page.waitForTimeout(3000);

        // 再次截圖
        const afterScreenshot = path.join(__dirname, 'after-checkin.png');
        await page.screenshot({ path: afterScreenshot, fullPage: true });
        log(`📸 簽到後截圖: ${afterScreenshot}`);

        log('🎉 簽到流程完成！');

    } catch (error) {
        log(`❌ 錯誤: ${error.message}`);
    } finally {
        if (browser) {
            await browser.close();
            log('🔒 瀏覽器已關閉');
        }
    }
}

checkin();
