/**
 * OiiOii.ai 雲端自動簽到腳本 (終極版 - 支援帳密登入)
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Supabase 設定
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://djmskkwpphomwmokiwf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_zYStzvFQRRxG2iFGNPYOZQ_UUxhIW-g';
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
            return JSON.parse(process.env.OIIOII_COOKIES);
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

        const cookiesData = getCookiesData();
        let loggedIn = false;

        // 策略 1: 使用 Cookies
        if (cookiesData) {
            console.log('🍪 嘗試使用 Cookies 登入...');
            await page.setCookie(...cookiesData.cookies);
            await page.goto('https://www.oiioii.ai/', { waitUntil: 'networkidle2' });

            // 檢查是否真的登入了
            const content = await page.content();
            loggedIn = content.includes('Free') || content.includes('Point');
        }

        // 策略 2: 如果 Cookies 失敗且有提供帳密，則執行帳密登入
        if (!loggedIn && OIIOII_EMAIL && OIIOII_PASSWORD) {
            console.log('🔑 Cookies 失效，嘗試帳號密碼登入...');
            await page.goto('https://www.oiioii.ai/login', { waitUntil: 'networkidle2' });

            // 填寫帳號
            await page.type('input[type="email"]', OIIOII_EMAIL, { delay: 50 });
            // 填寫密碼
            await page.type('input[type="password"]', OIIOII_PASSWORD, { delay: 50 });

            // 勾選同意條款
            try {
                const checkbox = await page.$('input[type="checkbox"]');
                if (checkbox) await checkbox.click();
            } catch (e) { }

            // 點擊登錄
            await Promise.all([
                page.click('button.ant-btn-primary'),
                page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => { })
            ]);

            await new Promise(r => setTimeout(r, 5000));
            loggedIn = true;
        }

        if (!loggedIn) {
            throw new Error('登入失敗！請檢查 Cookies 或帳號密碼設定。');
        }

        console.log('✅ 登入成功，準備抓取點數...');
        await page.goto('https://www.oiioii.ai/', { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 3000));

        // 1. 抓取簽到前點數
        let pointsBefore = await extractPoints(page);
        console.log(`📊 簽到前點數: ${pointsBefore}`);

        // 2. 點擊簽到
        let clicked = await tryClickCheckinButton(page);
        await new Promise(r => setTimeout(r, 5000));

        // 3. 抓取簽到後點數
        let pointsAfter = await extractPoints(page);
        console.log(`📊 簽到後點數: ${pointsAfter}`);

        let earned = pointsAfter > pointsBefore ? (pointsAfter - pointsBefore) : (clicked ? 300 : 0);

        // 4. 更新 Supabase
        const client = getSupabase();
        const { data: currentData } = await client.from(TABLE_NAME).select('*').eq('id', 1).single();

        const updateData = {
            id: 1,
            current_points: pointsAfter || pointsBefore,
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
        const navItems = Array.from(document.querySelectorAll('nav *, .ant-layout-header *'));
        for (let el of navItems) {
            const text = el.innerText?.trim();
            if (text && /^\d[\d,]*$/.test(text)) {
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
            if (text && /^\d[\d,]*$/.test(text) && text.length < 10) {
                return parseInt(text.replace(/,/g, ''));
            }
        }

        return 0;
    });
}

async function tryClickCheckinButton(page) {
    let clicked = false;
    const targets = ['Free', 'Points', '領取', '簽到'];
    for (let t of targets) {
        const btns = await page.$$('button, a, div[role="button"]');
        for (let btn of btns) {
            const text = await page.evaluate(el => el.innerText, btn);
            if (text.includes(t)) {
                await btn.click();
                clicked = true;
                break;
            }
        }
        if (clicked) break;
    }
    return clicked;
}

checkin();
