/**
 * OiiOii.ai 雲端自動簽到腳本
 * 用途：在 GitHub Actions 等雲端環境執行
 * 功能：自動簽到 + 抓取點數 + 更新數據檔案
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// 數據檔案路徑
const DATA_FILE = path.join(__dirname, 'dashboard', 'data', 'checkin-data.json');

// 從環境變數或檔案讀取 Cookies
function getCookiesData() {
    if (process.env.OIIOII_COOKIES) {
        console.log('📦 從環境變數讀取 Cookies...');
        try {
            const decoded = Buffer.from(process.env.OIIOII_COOKIES, 'base64').toString('utf8');
            return JSON.parse(decoded);
        } catch (e) {
            return JSON.parse(process.env.OIIOII_COOKIES);
        }
    }

    const cookiesFile = './cookies.json';
    if (fs.existsSync(cookiesFile)) {
        console.log('📦 從 cookies.json 讀取 Cookies...');
        return JSON.parse(fs.readFileSync(cookiesFile, 'utf8'));
    }

    throw new Error('找不到 Cookies！請先執行 npm run export-cookies');
}

// 讀取現有數據
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (e) {
        console.log('⚠️ 無法讀取現有數據，使用預設值');
    }

    return {
        currentPoints: 0,
        earnedPoints: 0,
        lastCheckin: null,
        status: 'pending',
        history: []
    };
}

// 保存數據
function saveData(data) {
    // 確保目錄存在
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('💾 已保存數據到:', DATA_FILE);
}

async function checkin() {
    const startTime = new Date();
    const timeStr = startTime.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    console.log(`🚀 [${timeStr}] 開始雲端自動簽到...`);

    // 載入現有數據
    let data = loadData();
    let pointsBefore = data.currentPoints || 0;
    let checkinResult = { time: timeStr, points: '+0', status: 'failed' };

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
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
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
            await page.reload({ waitUntil: 'networkidle2' });
        }

        // 等待頁面載入
        await new Promise(r => setTimeout(r, 5000));

        // 截圖（簽到前）
        console.log('📸 截取簽到前頁面...');
        await page.screenshot({ path: 'screenshot-before.png', fullPage: true });

        // 抓取當前點數（簽到前）
        console.log('🔍 抓取當前點數...');
        let currentPoints = await extractPoints(page);
        console.log(`   簽到前點數: ${currentPoints}`);

        if (currentPoints > 0) {
            pointsBefore = currentPoints;
        }

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

        // 尋找並點擊簽到按鈕
        console.log('🔍 尋找簽到按鈕...');
        let clicked = await tryClickCheckinButton(page);

        // 等待動作完成
        await new Promise(r => setTimeout(r, 3000));

        // 抓取點數（簽到後）
        let pointsAfter = await extractPoints(page);
        console.log(`   簽到後點數: ${pointsAfter}`);

        // 計算獲得的點數
        let earnedThisTime = 0;
        if (pointsAfter > pointsBefore) {
            earnedThisTime = pointsAfter - pointsBefore;
            console.log(`   🎁 本次獲得: +${earnedThisTime} 點`);
        }

        // 截圖（簽到後）
        await page.screenshot({ path: 'screenshot-after.png', fullPage: true });
        console.log('📸 已保存最終截圖');

        // 更新數據
        checkinResult = {
            time: timeStr,
            points: earnedThisTime > 0 ? `+${earnedThisTime}` : '+0',
            status: clicked ? 'success' : 'failed'
        };

        data.currentPoints = pointsAfter > 0 ? pointsAfter : pointsBefore;
        data.earnedPoints = (data.earnedPoints || 0) + earnedThisTime;
        data.lastCheckin = startTime.toISOString();
        data.status = clicked ? 'success' : 'pending';

        // 添加到歷史記錄（最多保留 20 筆）
        data.history = [checkinResult, ...(data.history || [])].slice(0, 20);

        const endTime = new Date();
        const duration = (endTime - startTime) / 1000;
        console.log(`🎉 簽到流程完成！耗時 ${duration.toFixed(1)} 秒`);

        // 輸出結果
        if (process.env.GITHUB_OUTPUT) {
            fs.appendFileSync(process.env.GITHUB_OUTPUT, `status=success\n`);
            fs.appendFileSync(process.env.GITHUB_OUTPUT, `clicked=${clicked}\n`);
            fs.appendFileSync(process.env.GITHUB_OUTPUT, `points=${data.currentPoints}\n`);
        }

    } catch (error) {
        console.error(`❌ 錯誤: ${error.message}`);

        checkinResult.status = 'failed';
        data.status = 'error';
        data.history = [checkinResult, ...(data.history || [])].slice(0, 20);

        if (process.env.GITHUB_OUTPUT) {
            fs.appendFileSync(process.env.GITHUB_OUTPUT, `status=error\n`);
            fs.appendFileSync(process.env.GITHUB_OUTPUT, `error=${error.message}\n`);
        }

        // 不要 exit(1)，讓數據仍然可以保存
    } finally {
        // 保存數據
        saveData(data);

        if (browser) {
            await browser.close();
            console.log('🔒 瀏覽器已關閉');
        }
    }
}

// 從頁面抓取點數
async function extractPoints(page) {
    try {
        // 嘗試多種方式抓取點數
        const points = await page.evaluate(() => {
            // 方法 1: 尋找包含數字的元素（通常在右上角）
            const allElements = document.querySelectorAll('*');
            for (const el of allElements) {
                const text = el.textContent?.trim() || '';
                // 尋找類似 "1,310" 或 "Free Points" 附近的數字
                const match = text.match(/^[\d,]+$/);
                if (match && text.length < 10) {
                    const num = parseInt(text.replace(/,/g, ''));
                    if (num > 0 && num < 1000000) {
                        // 檢查是否在頁面右上角區域
                        const rect = el.getBoundingClientRect();
                        if (rect.right > window.innerWidth * 0.7 && rect.top < 100) {
                            return num;
                        }
                    }
                }
            }

            // 方法 2: 尋找 "Point" 相關元素
            const pointElements = document.querySelectorAll('[class*="point" i], [class*="credit" i]');
            for (const el of pointElements) {
                const text = el.textContent || '';
                const match = text.match(/(\d[\d,]*)/);
                if (match) {
                    return parseInt(match[1].replace(/,/g, ''));
                }
            }

            return 0;
        });

        return points || 0;
    } catch (e) {
        console.log(`   抓取點數失敗: ${e.message}`);
        return 0;
    }
}

// 嘗試點擊簽到按鈕
async function tryClickCheckinButton(page) {
    let clicked = false;

    // 方法 1: 尋找包含 "Free" 的可點擊元素
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
                    console.log(`   找到元素: ${tagName} - "${text.substring(0, 30)}..."`);
                    await element.click();
                    clicked = true;
                    console.log('✅ 已點擊！');
                    break;
                }
            }
        }
    } catch (e) {
        console.log(`   搜尋失敗: ${e.message}`);
    }

    // 方法 2: XPath
    if (!clicked) {
        try {
            const [button] = await page.$x("//*[contains(text(), 'Free')]");
            if (button) {
                await button.click();
                clicked = true;
                console.log('✅ 透過 XPath 點擊成功！');
            }
        } catch (e) {
            console.log(`   XPath 失敗: ${e.message}`);
        }
    }

    // 方法 3: 點擊座標（備用）
    if (!clicked) {
        console.log('   嘗試點擊右上角...');
        try {
            await page.mouse.click(950, 50);
            await new Promise(r => setTimeout(r, 1000));
            console.log('   已嘗試點擊座標');
        } catch (e) {
            console.log(`   座標點擊失敗: ${e.message}`);
        }
    }

    return clicked;
}

checkin();
