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
            await page.goto('https://www.oiioii.ai/login', { waitUntil: 'networkidle2' });
            await new Promise(r => setTimeout(r, 2000));

            // 填寫帳號
            const emailInput = await page.$('input[type="email"], input[type="text"]');
            if (emailInput) {
                await emailInput.type(OIIOII_EMAIL, { delay: 50 });
                console.log('✅ 已填寫帳號');
            }

            // 填寫密碼
            const passInput = await page.$('input[type="password"]');
            if (passInput) {
                await passInput.type(OIIOII_PASSWORD, { delay: 50 });
                console.log('✅ 已填寫密碼');
            }

            // 勾選同意條款
            try {
                const checkbox = await page.$('input[type="checkbox"]');
                if (checkbox) {
                    await checkbox.click();
                    console.log('✅ 已勾選同意條款');
                }
            } catch (e) { }

            await new Promise(r => setTimeout(r, 1000));

            // 點擊登入按鈕 (嘗試多種方式)
            const loginClicked = await page.evaluate(() => {
                // 方法1: 找含有「登」字的按鈕
                const buttons = Array.from(document.querySelectorAll('button'));
                for (let btn of buttons) {
                    const text = btn.innerText || '';
                    if (text.includes('登') || text.toLowerCase().includes('login') || text.toLowerCase().includes('sign in')) {
                        btn.click();
                        return 'button with login text';
                    }
                }
                // 方法2: 找表單中的提交按鈕
                const formBtn = document.querySelector('form button[type="submit"], form button:last-child');
                if (formBtn) {
                    formBtn.click();
                    return 'form submit button';
                }
                // 方法3: 找粉色/主要按鈕
                const allBtns = document.querySelectorAll('button');
                if (allBtns.length > 0) {
                    allBtns[allBtns.length - 1].click();
                    return 'last button';
                }
                return false;
            });

            if (loginClicked) {
                console.log(`✅ 已點擊登入按鈕 (${loginClicked})`);
                await new Promise(r => setTimeout(r, 5000));

                // 檢查是否登入成功
                const currentUrl = page.url();
                if (!currentUrl.includes('/login')) {
                    loggedIn = true;
                    console.log('✅ 登入成功！');
                }
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
        // 方法 1: 尋找導覽列中的數字
        const navItems = Array.from(document.querySelectorAll('nav *, header *, [class*="header"] *'));
        for (let el of navItems) {
            const text = el.innerText?.trim();
            if (text && /^\d[\d,]*$/.test(text) && text.length < 8) {
                return parseInt(text.replace(/,/g, ''));
            }
        }

        // 方法 2: 全域搜尋有 "Points" 文字的鄰近數字
        const bodyText = document.body.innerText;
        const pointMatch = bodyText.match(/(\d[\d,]*)\s*Points/i);
        if (pointMatch) return parseInt(pointMatch[1].replace(/,/g, ''));

        // 方法 3: 尋找右上角特定區域
        const possiblePoints = Array.from(document.querySelectorAll('*'))
            .filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.top < 100 && rect.right > window.innerWidth * 0.7;
            });

        for (let el of possiblePoints) {
            const text = el.innerText?.trim();
            if (text && /^\d[\d,]*$/.test(text) && text.length < 8) {
                return parseInt(text.replace(/,/g, ''));
            }
        }

        return 0;
    });
}

async function tryClickCheckinButton(page) {
    return await page.evaluate(() => {
        const targets = ['Free', 'Points', '領取', '簽到', '免費', 'Claim', 'Daily'];
        const elements = Array.from(document.querySelectorAll('button, a, div[role="button"], span'));

        for (let target of targets) {
            for (let el of elements) {
                const text = el.innerText || '';
                if (text.includes(target)) {
                    el.click();
                    return true;
                }
            }
        }
        return false;
    });
}

checkin();
