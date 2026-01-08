/**
 * OiiOii.ai 雲端自動簽到腳本
 * 用途：在 GitHub Actions 等雲端環境執行
 * 功能：自動簽到 + 抓取點數 + 保存到 Supabase
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Supabase 設定
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://djmskkwpphomwmokiwf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_zYStzvFQRRxG2iFGNPYOZQ_UUxhIW-g';
const TABLE_NAME = 'oiioii便當專員';

let supabase = null;

function getSupabase() {
    if (!supabase) {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('🔥 Supabase 已初始化');
    }
    return supabase;
}

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

// 讀取 Supabase 數據
async function loadCheckinData() {
    try {
        const client = getSupabase();
        const { data, error } = await client
            .from(TABLE_NAME)
            .select('*')
            .eq('id', 1)
            .single();

        if (error) {
            console.log('⚠️ Supabase 讀取失敗:', error.message);
            return getDefaultData();
        }

        console.log('📖 從 Supabase 讀取數據成功');
        return data;
    } catch (error) {
        console.error('❌ Supabase 讀取失敗:', error.message);
        return getDefaultData();
    }
}

// 保存數據到 Supabase
async function saveCheckinData(data) {
    try {
        const client = getSupabase();
        data.updated_at = new Date().toISOString();
        data.id = 1;

        const { error } = await client
            .from(TABLE_NAME)
            .upsert(data, { onConflict: 'id' });

        if (error) throw error;

        console.log('💾 數據已保存到 Supabase');
        return true;
    } catch (error) {
        console.error('❌ Supabase 保存失敗:', error.message);
        return false;
    }
}

function getDefaultData() {
    return {
        id: 1,
        current_points: 0,
        earned_points: 0,
        last_checkin: null,
        status: 'pending',
        history: []
    };
}

async function checkin() {
    const startTime = new Date();
    const timeStr = startTime.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    console.log(`🚀 [${timeStr}] 開始雲端自動簽到...`);

    // 載入現有數據
    let data = await loadCheckinData();
    let pointsBefore = data.current_points || 0;
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
            await page.evaluate((storageData) => {
                for (const [key, value] of Object.entries(storageData)) {
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

        data.current_points = pointsAfter > 0 ? pointsAfter : pointsBefore;
        data.earned_points = (data.earned_points || 0) + earnedThisTime;
        data.last_checkin = startTime.toISOString();
        data.status = clicked ? 'success' : 'pending';

        // 添加到歷史記錄（最多保留 50 筆）
        data.history = [checkinResult, ...(data.history || [])].slice(0, 50);

        const endTime = new Date();
        const duration = (endTime - startTime) / 1000;
        console.log(`🎉 簽到流程完成！耗時 ${duration.toFixed(1)} 秒`);

        // 輸出結果
        if (process.env.GITHUB_OUTPUT) {
            fs.appendFileSync(process.env.GITHUB_OUTPUT, `status=success\n`);
            fs.appendFileSync(process.env.GITHUB_OUTPUT, `clicked=${clicked}\n`);
            fs.appendFileSync(process.env.GITHUB_OUTPUT, `points=${data.current_points}\n`);
        }

    } catch (error) {
        console.error(`❌ 錯誤: ${error.message}`);

        checkinResult.status = 'failed';
        data.status = 'error';
        data.history = [checkinResult, ...(data.history || [])].slice(0, 50);

        if (process.env.GITHUB_OUTPUT) {
            fs.appendFileSync(process.env.GITHUB_OUTPUT, `status=error\n`);
            fs.appendFileSync(process.env.GITHUB_OUTPUT, `error=${error.message}\n`);
        }
    } finally {
        // 保存數據到 Supabase
        await saveCheckinData(data);

        if (browser) {
            await browser.close();
            console.log('🔒 瀏覽器已關閉');
        }
    }
}

// 從頁面抓取點數
async function extractPoints(page) {
    try {
        const points = await page.evaluate(() => {
            const allElements = document.querySelectorAll('*');
            for (const el of allElements) {
                const text = el.textContent?.trim() || '';
                const match = text.match(/^[\d,]+$/);
                if (match && text.length < 10) {
                    const num = parseInt(text.replace(/,/g, ''));
                    if (num > 0 && num < 1000000) {
                        const rect = el.getBoundingClientRect();
                        if (rect.right > window.innerWidth * 0.7 && rect.top < 100) {
                            return num;
                        }
                    }
                }
            }

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
