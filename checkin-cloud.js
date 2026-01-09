/**
 * OiiOii.ai 雲端自動簽到腳本 (終極版 - 支援帳密登入)
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Supabase 設定
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://djmskkwpprhomwmokiwf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_zYStzvFQRRxG2iFGNPYOZQ_JUxhlWr9';
const TABLE_NAME = 'oiioii便當專員';

// 帳密設定
const OIIOII_EMAIL = process.env.OIIOII_EMAIL;
const OIIOII_PASSWORD = process.env.OIIOII_PASSWORD;

let supabase = null;

function getSupabase() {
    if (!supabase) {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return supabase;
}

// 讀取 Cookies Data
function getCookiesData() {
    if (process.env.OIIOII_COOKIES) {
        try {
            const decoded = Buffer.from(process.env.OIIOII_COOKIES, 'base64').toString('utf8');
            return JSON.parse(decoded);
        } catch (e) {
            try {
                return JSON.parse(process.env.OIIOII_COOKIES);
            } catch (e2) {
                return null;
            }
        }
    }
    return null;
}

async function checkin() {
    const startTime = new Date();
    const timeStr = startTime.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    console.log(`🚀 [${timeStr}] 開始執行自動簽到任務...`);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 800 });

        let loggedIn = false;

        // 策略 1: 使用帳密登入 (優先)
        if (OIIOII_EMAIL && OIIOII_PASSWORD) {
            console.log('🔑 使用帳號密碼登入...');
            console.log(`📧 帳號: ${OIIOII_EMAIL.substring(0, 3)}****`);
            await page.goto('https://www.oiioii.ai/login', { waitUntil: 'networkidle2' });
            await new Promise(r => setTimeout(r, 5000)); // 等待更久

            // 先截圖看登入頁面狀態
            try {
                await page.screenshot({ path: 'screenshot-login-page.png', fullPage: false });
                console.log('📸 已截圖登入頁面');
            } catch (e) { }

            // 檢查頁面內容
            const pageContent = await page.content();
            console.log(`📄 頁面是否包含 email 輸入框: ${pageContent.includes('id="email"')}`);
            console.log(`📄 頁面是否包含 password 輸入框: ${pageContent.includes('id="password"')}`);
            console.log(`📄 頁面是否包含 submit 按鈕: ${pageContent.includes('type="submit"')}`);


            // 填寫帳號 (使用 #email 選擇器)
            try {
                await page.type('#email', OIIOII_EMAIL, { delay: 30 });
                console.log('✅ 已填寫帳號');
            } catch (e) {
                console.log('⚠️ 找不到 #email，嘗試其他選擇器');
                const emailInput = await page.$('input[type="email"], input[type="text"]');
                if (emailInput) await emailInput.type(OIIOII_EMAIL, { delay: 30 });
            }

            // 填寫密碼 (使用 #password 選擇器)
            try {
                await page.type('#password', OIIOII_PASSWORD, { delay: 30 });
                console.log('✅ 已填寫密碼');
            } catch (e) {
                console.log('⚠️ 找不到 #password，嘗試其他選擇器');
                const passInput = await page.$('input[type="password"]');
                if (passInput) await passInput.type(OIIOII_PASSWORD, { delay: 30 });
            }

            // 勾選同意條款 (使用 #agreed 選擇器)
            try {
                const isChecked = await page.$eval('#agreed', el => el.checked);
                if (!isChecked) {
                    await page.click('#agreed');
                    console.log('✅ 已勾選同意條款');
                }
            } catch (e) {
                try {
                    const checkbox = await page.$('input[type="checkbox"]');
                    if (checkbox) await checkbox.click();
                } catch (e2) { }
            }

            await new Promise(r => setTimeout(r, 1000));

            // 點擊登入按鈕 (使用 button[type="submit"] - 這是表單的提交按鈕)
            try {
                await page.click('button[type="submit"]');
                console.log('✅ 已點擊登入按鈕 (button[type=submit])');
            } catch (e) {
                console.log('⚠️ 找不到 submit 按鈕，嘗試其他方式');
                await page.evaluate(() => {
                    const formBtn = document.querySelector('form button');
                    if (formBtn) formBtn.click();
                });
            }

            // 等待登入完成
            await new Promise(r => setTimeout(r, 5000));

            // 檢查是否登入成功
            const currentUrl = page.url();
            console.log(`📍 當前網址: ${currentUrl}`);
            if (!currentUrl.includes('/login')) {
                loggedIn = true;
                console.log('✅ 登入成功！');
            } else {
                console.log('⚠️ 可能還在登入頁面，繼續嘗試...');
            }
        }

        // 策略 2: 使用 Cookies (備用)
        if (!loggedIn) {
            const cookiesData = getCookiesData();
            if (cookiesData && cookiesData.cookies) {
                console.log('🍪 嘗試使用 Cookies 登入...');
                await page.setCookie(...cookiesData.cookies);
                await page.goto('https://www.oiioii.ai/', { waitUntil: 'networkidle2' });

                const content = await page.content();
                loggedIn = content.includes('Free') || content.includes('Point') || content.includes('積分');
            }
        }

        // 前往首頁準備簽到
        console.log('📍 前往首頁...');
        await page.goto('https://www.oiioii.ai/', { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 3000));

        // 截圖 (用於診斷)
        try {
            await page.screenshot({ path: 'screenshot-before.png', fullPage: false });
            console.log('📸 已截圖 screenshot-before.png');
        } catch (e) { }

        // 1. 抓取簽到前點數
        let pointsBefore = await extractPoints(page);
        console.log(`📊 簽到前點數: ${pointsBefore}`);

        // 2. 點擊簽到
        let clicked = await tryClickCheckinButton(page);
        console.log(`🖱️ 點擊簽到按鈕: ${clicked ? '成功' : '未找到'}`);
        await new Promise(r => setTimeout(r, 5000));

        // 3. 抓取簽到後點數
        let pointsAfter = await extractPoints(page);
        console.log(`📊 簽到後點數: ${pointsAfter}`);

        // 截圖 (用於診斷)
        try {
            await page.screenshot({ path: 'screenshot-after.png', fullPage: false });
            console.log('📸 已截圖 screenshot-after.png');
        } catch (e) { }

        let earned = pointsAfter > pointsBefore ? (pointsAfter - pointsBefore) : (clicked ? 300 : 0);

        // 4. 更新 Supabase
        try {
            const client = getSupabase();
            const { data: currentData } = await client.from(TABLE_NAME).select('*').eq('id', 1).single();

            const updateData = {
                id: 1,
                current_points: pointsAfter || pointsBefore || (currentData?.current_points || 0),
                earned_points: (currentData?.earned_points || 0) + earned,
                last_checkin: new Date().toISOString(),
                status: clicked ? 'success' : 'pending',
                history: [{
                    time: timeStr,
                    points: earned > 0 ? `+${earned}` : '+0',
                    status: clicked ? 'success' : 'failed'
                }, ...(currentData?.history || [])].slice(0, 50),
                updated_at: new Date().toISOString()
            };

            await client.from(TABLE_NAME).upsert(updateData);
            console.log(`✅ 已更新 Supabase 資料`);
        } catch (dbError) {
            console.error(`⚠️ Supabase 更新失敗: ${dbError.message}`);
        }

        console.log(`🎉 任務完成！獲得點數: ${earned}`);

    } catch (error) {
        console.error(`❌ 執行出錯: ${error.message}`);
    } finally {
        if (browser) await browser.close();
    }
}

async function extractPoints(page) {
    return await page.evaluate(() => {
        // 方法 1: OiiOii 網站的專用選擇器 (登入後顯示的點數)
        const creditAmount = document.querySelector('[class*="credit-amount"]');
        if (creditAmount) {
            const text = creditAmount.innerText?.trim();
            if (text && /^\d+$/.test(text)) {
                return parseInt(text);
            }
        }

        // 方法 2: 尋找 credit-balance 選擇器
        const creditBalance = document.querySelector('[class*="credit-balance"]');
        if (creditBalance) {
            const match = creditBalance.innerText?.match(/(\d+)/);
            if (match) return parseInt(match[1]);
        }

        // 方法 3: 尋找「盒飯」或「Points」相關的數字
        const allElements = Array.from(document.querySelectorAll('*'));
        for (let el of allElements) {
            const text = el.innerText?.trim();
            // 找純數字且在合理範圍內 (1-99999)
            if (text && /^\d+$/.test(text) && text.length < 6 && parseInt(text) > 0) {
                const rect = el.getBoundingClientRect();
                // 確保在頁面上方 (頭部區域)
                if (rect.top < 150 && rect.right > window.innerWidth * 0.5) {
                    return parseInt(text);
                }
            }
        }

        // 方法 4: 搜尋頁面文字中的數字
        const bodyText = document.body.innerText;
        const pointMatch = bodyText.match(/(\d+)\s*(盒飯|Points|積分)/i);
        if (pointMatch) return parseInt(pointMatch[1]);

        return 0;
    });
}

async function tryClickCheckinButton(page) {
    return await page.evaluate(() => {
        // OiiOii 網站的簽到按鈕關鍵字
        const targets = ['赚盒饭', 'Earn Bento', 'Free', 'Points', '領取', '簽到', '免費', 'Claim', 'Daily', '盒飯', 'Credit'];
        const elements = Array.from(document.querySelectorAll('button, a, div[role="button"], span, [class*="credit"]'));

        for (let target of targets) {
            for (let el of elements) {
                const text = el.innerText || '';
                if (text.includes(target)) {
                    el.click();
                    console.log('Clicked element with text:', text.substring(0, 30));
                    return true;
                }
            }
        }
        return false;
    });
}

checkin();
