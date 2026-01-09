/**
 * OiiOii.ai ?²ç«¯?ªå?ç°½åˆ°?³æœ¬ (çµ‚æ¥µ??- ?¯æ´å¸³å??»å…¥)
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Supabase è¨­å?
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://djmskkwpprhomwmokiwf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_zYStzvFQRRxG2iFGNPYOZQ_UUxhIW-g';
const TABLE_NAME = 'oiioiiä¾¿ç•¶å°ˆå“¡';

// å¸³å?è¨­å?
const OIIOII_EMAIL = process.env.OIIOII_EMAIL;
const OIIOII_PASSWORD = process.env.OIIOII_PASSWORD;

let supabase = null;

function getSupabase() {
    if (!supabase) {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return supabase;
}

// è®€??Cookies Data
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
    console.log(`?? [${timeStr}] ?‹å??·è??ªå?ç°½åˆ°ä»»å?...`);

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

        // ç­–ç•¥ 1: ä½¿ç”¨ Cookies
        if (cookiesData) {
            console.log('?ª ?—è©¦ä½¿ç”¨ Cookies ?»å…¥...');
            await page.setCookie(...cookiesData.cookies);
            await page.goto('https://www.oiioii.ai/', { waitUntil: 'networkidle2' });

            // æª¢æŸ¥?¯å¦?Ÿç??»å…¥äº?
            const content = await page.content();
            loggedIn = content.includes('Free') || content.includes('Point');
        }

        // ç­–ç•¥ 2: å¦‚æ? Cookies å¤±æ?ä¸”æ??ä?å¸³å?ï¼Œå??·è?å¸³å??»å…¥
        if (!loggedIn && OIIOII_EMAIL && OIIOII_PASSWORD) {
            console.log('?? Cookies å¤±æ?ï¼Œå?è©¦å¸³?Ÿå?ç¢¼ç™»??..');
            await page.goto('https://www.oiioii.ai/login', { waitUntil: 'networkidle2' });

            // å¡«å¯«å¸³è?
            await page.type('input[type="email"]', OIIOII_EMAIL, { delay: 50 });
            // å¡«å¯«å¯†ç¢¼
            await page.type('input[type="password"]', OIIOII_PASSWORD, { delay: 50 });

            // ?¾é¸?Œæ?æ¢æ¬¾
            try {
                const checkbox = await page.$('input[type="checkbox"]');
                if (checkbox) await checkbox.click();
            } catch (e) { }

            // é»žæ??»é?
            await Promise.all([
                page.click('button.ant-btn-primary'),
                page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => { })
            ]);

            await new Promise(r => setTimeout(r, 5000));
            loggedIn = true;
        }

        if (!loggedIn) {
            throw new Error('?»å…¥å¤±æ?ï¼è?æª¢æŸ¥ Cookies ?–å¸³?Ÿå?ç¢¼è¨­å®šã€?);
        }

        console.log('???»å…¥?å?ï¼Œæ??™æ??–é???..');
        await page.goto('https://www.oiioii.ai/', { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 3000));

        // 1. ?“å?ç°½åˆ°?é???
        let pointsBefore = await extractPoints(page);
        console.log(`?? ç°½åˆ°?é??? ${pointsBefore}`);

        // 2. é»žæ?ç°½åˆ°
        let clicked = await tryClickCheckinButton(page);
        await new Promise(r => setTimeout(r, 5000));

        // 3. ?“å?ç°½åˆ°å¾Œé???
        let pointsAfter = await extractPoints(page);
        console.log(`?? ç°½åˆ°å¾Œé??? ${pointsAfter}`);

        let earned = pointsAfter > pointsBefore ? (pointsAfter - pointsBefore) : (clicked ? 300 : 0);

        // 4. ?´æ–° Supabase
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
        console.log(`?? ä»»å?å®Œæ?ï¼ç²å¾—é??? ${earned}`);

    } catch (error) {
        console.error(`???·è??ºéŒ¯: ${error.message}`);
    } finally {
        if (browser) await browser.close();
    }
}

async function extractPoints(page) {
    return await page.evaluate(() => {
        // ?¹æ? 1: å°‹æ‰¾å°Žè¦½?—ä¸­?„æ•¸å­?
        const navItems = Array.from(document.querySelectorAll('nav *, .ant-layout-header *'));
        for (let el of navItems) {
            const text = el.innerText?.trim();
            if (text && /^\d[\d,]*$/.test(text)) {
                return parseInt(text.replace(/,/g, ''));
            }
        }

        // ?¹æ? 2: ?¨å??œå???"Points" ?‡å??„é„°è¿‘æ•¸å­?
        const bodyText = document.body.innerText;
        const pointMatch = bodyText.match(/(\d[\d,]*)\s*Points/i);
        if (pointMatch) return parseInt(pointMatch[1].replace(/,/g, ''));

        // ?¹æ? 3: å°‹æ‰¾?³ä?è§’ç‰¹å®šå???
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
    const targets = ['Free', 'Points', '?˜å?', 'ç°½åˆ°'];
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
