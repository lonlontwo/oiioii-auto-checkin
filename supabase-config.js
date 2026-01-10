/**
 * Supabase ?�置
 * ?�於存儲 OiiOii 便當專員?�簽?�數??
 */

// 必須通過環境變數設定（GitHub Secrets 或本地 .env）
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('⚠️ 未設定 SUPABASE_URL 或 SUPABASE_KEY 環境變數');
}

// 資�?表�?�?
const TABLE_NAME = 'oiioii便當專員';

module.exports = {
    SUPABASE_URL,
    SUPABASE_KEY,
    TABLE_NAME
};
