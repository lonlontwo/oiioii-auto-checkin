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

        // 除錯：列出頁面頭部區域所有的數字
        const debugNumbers = await page.evaluate(() => {
            const results = [];
            document.querySelectorAll('*').forEach(el => {
                const text = el.innerText?.trim();
                if (text && /^\d+$/.test(text)) {
                    const rect = el.getBoundingClientRect();
                    if (rect.top < 200) {  // 只看頁面頂部 200px 內
                        results.push({
                            text: text,
                            tag: el.tagName,
                            class: el.className?.substring?.(0, 50) || '',
                            top: Math.round(rect.top),
                            right: Math.round(rect.right)
                        });
                    }
                }
            });
            return results;
        });
        console.log('🔍 頁面頂部找到的數字元素:');
        debugNumbers.forEach((item, i) => {
            console.log(`   ${i + 1}. "${item.text}" - ${item.tag} class="${item.class}" (top:${item.top}, right:${item.right})`);
        });

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
        // 方法 1: 找到包含 counter-number 的父容器，把所有數字組合起來
        const counterNumbers = document.querySelectorAll('[class*="counter-number"]');
        if (counterNumbers.length > 0) {
            // 找到這些元素共同的父容器
            const parent = counterNumbers[0].parentElement?.parentElement;
            if (parent) {
                // 取得父容器的純數字文字（過濾掉非數字字符）
                const allText = parent.innerText?.replace(/[^\d]/g, '');
                if (allText && allText.length > 2) {
                    console.log('Found counter parent text:', allText);
                    return parseInt(allText);
                }
            }

            // 如果父容器方法失敗，嘗試組合所有 counter-number 的數字
            let combined = '';
            counterNumbers.forEach(el => {
                const digit = el.innerText?.trim();
                if (digit && /^\d$/.test(digit)) {
                    combined += digit;
                }
            });
            if (combined.length > 2) {
                console.log('Combined counter numbers:', combined);
                return parseInt(combined);
            }
        }

        // 方法 2: 找包含 credit 關鍵字的容器
        const creditContainers = document.querySelectorAll('[class*="credit"]');
        for (let container of creditContainers) {
            const text = container.innerText?.replace(/[^\d]/g, '');
            if (text && text.length >= 3 && parseInt(text) > 100) {
                console.log('Found credit container text:', text);
                return parseInt(text);
            }
        }

        // 方法 3: 在頁面頂部找多位數的數字
        const allElements = Array.from(document.querySelectorAll('*'));
        for (let el of allElements) {
            const rect = el.getBoundingClientRect();
            if (rect.top < 100 && rect.right > window.innerWidth * 0.6) {
                const text = el.innerText?.trim();
                // 找 3 位以上的純數字
                if (text && /^\d{3,}$/.test(text)) {
                    console.log('Found number in header:', text);
                    return parseInt(text);
                }
            }
        }

        // 方法 4: 搜尋整個頁面的大數字
        const bodyText = document.body.innerText;
        const matches = bodyText.match(/\b(\d{3,5})\b/g);
        if (matches) {
            // 找最大的合理數字（可能是點數）
            const numbers = matches.map(m => parseInt(m)).filter(n => n > 100 && n < 100000);
            if (numbers.length > 0) {
                const largest = Math.max(...numbers);
                console.log('Found largest number in page:', largest);
                return largest;
            }
        }

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
