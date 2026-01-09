/**
 * Supabase ?�置
 * ?�於存儲 OiiOii 便當專員?�簽?�數??
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://djmskkwpprhomwmokiwf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_zYStzvFQRRxG2iFGNPYOZQ_UUxhIW-g';

// 資�?表�?�?
const TABLE_NAME = 'oiioii便當專員';

module.exports = {
    SUPABASE_URL,
    SUPABASE_KEY,
    TABLE_NAME
};
