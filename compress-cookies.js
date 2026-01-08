/**
 * 壓縮 Cookies 腳本
 * 只保留 oiioii.ai 相關的 cookies，移除不必要的資料
 */

const fs = require('fs');
const path = require('path');

const COOKIES_FILE = path.join(__dirname, 'cookies.json');
const COMPRESSED_FILE = path.join(__dirname, 'cookies-compressed.json');
const BASE64_FILE = path.join(__dirname, 'cookies-base64-small.txt');

function compress() {
    console.log('📦 讀取原始 cookies...');
    const data = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));

    console.log(`   原始 cookies 數量: ${data.cookies.length}`);

    // 只保留 oiioii.ai 相關的 cookies
    const filteredCookies = data.cookies.filter(cookie => {
        return cookie.domain && (
            cookie.domain.includes('oiioii') ||
            cookie.domain.includes('hogi') ||
            cookie.domain.includes('google') ||
            cookie.domain.includes('gstatic')
        );
    });

    // 移除不必要的屬性
    const minimalCookies = filteredCookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path || '/',
        expires: cookie.expires,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite
    }));

    console.log(`   過濾後 cookies 數量: ${minimalCookies.length}`);

    // 只保留必要的 localStorage 項目
    const filteredLocalStorage = {};
    if (data.localStorage) {
        for (const [key, value] of Object.entries(data.localStorage)) {
            // 只保留看起來重要的項目
            if (key.includes('token') ||
                key.includes('auth') ||
                key.includes('user') ||
                key.includes('session') ||
                key.length < 50) {
                // 限制 value 長度
                if (value && value.length < 5000) {
                    filteredLocalStorage[key] = value;
                }
            }
        }
    }

    const compressed = {
        cookies: minimalCookies,
        localStorage: filteredLocalStorage,
        exportedAt: data.exportedAt,
        url: data.url
    };

    // 保存壓縮後的 JSON
    const compressedJson = JSON.stringify(compressed);
    fs.writeFileSync(COMPRESSED_FILE, JSON.stringify(compressed, null, 2));

    // 轉換為 Base64
    const base64 = Buffer.from(compressedJson).toString('base64');
    fs.writeFileSync(BASE64_FILE, base64);

    const originalSize = fs.statSync(COOKIES_FILE).size;
    const compressedSize = base64.length;

    console.log('');
    console.log('✅ 壓縮完成！');
    console.log(`   原始大小: ${(originalSize / 1024).toFixed(1)} KB`);
    console.log(`   壓縮後大小: ${(compressedSize / 1024).toFixed(1)} KB`);
    console.log('');

    if (compressedSize > 64000) {
        console.log('⚠️ 仍然太大！嘗試進一步壓縮...');

        // 只保留最關鍵的 cookies
        const essentialCookies = minimalCookies.filter(cookie => {
            return cookie.domain && cookie.domain.includes('oiioii');
        });

        const minimal = {
            cookies: essentialCookies,
            localStorage: {},
            exportedAt: data.exportedAt,
            url: data.url
        };

        const minimalJson = JSON.stringify(minimal);
        const minimalBase64 = Buffer.from(minimalJson).toString('base64');
        fs.writeFileSync(BASE64_FILE, minimalBase64);

        console.log(`   最終大小: ${(minimalBase64.length / 1024).toFixed(1)} KB`);
    }

    console.log('');
    console.log('📋 請使用 cookies-base64-small.txt 的內容');
    console.log('   檔案位置: ' + BASE64_FILE);
}

compress();
