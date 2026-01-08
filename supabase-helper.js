/**
 * Supabase 數據操作模組
 * 讀寫 OiiOii 便當專員的簽到數據
 */

const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_KEY, TABLE_NAME } = require('./supabase-config');

// 初始化 Supabase 客戶端
let supabase = null;

function getSupabase() {
    if (!supabase) {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('🔥 Supabase 已初始化');
    }
    return supabase;
}

/**
 * 讀取簽到數據
 */
async function loadCheckinData() {
    try {
        const client = getSupabase();
        const { data, error } = await client
            .from(TABLE_NAME)
            .select('*')
            .eq('id', 1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // 資料不存在，創建初始資料
                console.log('📖 Supabase 中沒有數據，創建初始資料...');
                const defaultData = getDefaultData();
                await saveCheckinData(defaultData);
                return defaultData;
            }
            throw error;
        }

        console.log('📖 從 Supabase 讀取數據成功');
        return data;
    } catch (error) {
        console.error('❌ Supabase 讀取失敗:', error.message);
        return getDefaultData();
    }
}

/**
 * 保存簽到數據
 */
async function saveCheckinData(data) {
    try {
        const client = getSupabase();

        // 添加更新時間
        data.updated_at = new Date().toISOString();
        data.id = 1; // 固定 ID

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

/**
 * 更新點數和添加記錄
 */
async function updateCheckinResult(currentPoints, earnedThisTime, status) {
    try {
        const data = await loadCheckinData();

        const timeStr = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

        // 更新數據
        data.current_points = currentPoints;
        data.earned_points = (data.earned_points || 0) + earnedThisTime;
        data.last_checkin = new Date().toISOString();
        data.status = status;

        // 添加歷史記錄
        const newRecord = {
            time: timeStr,
            points: earnedThisTime > 0 ? `+${earnedThisTime}` : '+0',
            status: status
        };

        data.history = [newRecord, ...(data.history || [])].slice(0, 50);

        await saveCheckinData(data);

        console.log(`📊 點數已更新: 當前 ${currentPoints}, 累計獲得 ${data.earned_points}`);
        return true;
    } catch (error) {
        console.error('❌ 更新點數失敗:', error.message);
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
        history: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
}

module.exports = {
    getSupabase,
    loadCheckinData,
    saveCheckinData,
    updateCheckinResult
};
