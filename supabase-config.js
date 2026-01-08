/**
 * Supabase 配置
 * 用於存儲 OiiOii 便當專員的簽到數據
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://djmskkwpphomwmokiwf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_zYStzvFQRRxG2iFGNPYOZQ_UUxhIW-g';

// 資料表名稱
const TABLE_NAME = 'oiioii便當專員';

module.exports = {
    SUPABASE_URL,
    SUPABASE_KEY,
    TABLE_NAME
};
