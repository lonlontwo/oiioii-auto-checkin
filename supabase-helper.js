/**
 * Supabase ?��??��?模�?
 * 讀�?OiiOii 便當專員?�簽?�數??
 */

const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_KEY, TABLE_NAME } = require('./supabase-config');

// ?��???Supabase 客戶�?
let supabase = null;

function getSupabase() {
    if (!supabase) {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('?�� Supabase 已�?始�?');
    }
    return supabase;
}

/**
 * 讀?�簽?�數??
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
                // 資�?不�??��??�建?��?資�?
                console.log('?? Supabase 中�??�數?��??�建?��?資�?...');
                const defaultData = getDefaultData();
                await saveCheckinData(defaultData);
                return defaultData;
            }
            throw error;
        }

        console.log('?? �?Supabase 讀?�數?��???);
        return data;
    } catch (error) {
        console.error('??Supabase 讀?�失??', error.message);
        return getDefaultData();
    }
}

/**
 * 保�?簽到?��?
 */
async function saveCheckinData(data) {
    try {
        const client = getSupabase();

        // 添�??�新?��?
        data.updated_at = new Date().toISOString();
        data.id = 1; // ?��? ID

        const { error } = await client
            .from(TABLE_NAME)
            .upsert(data, { onConflict: 'id' });

        if (error) throw error;

        console.log('?�� ?��?已�?存到 Supabase');
        return true;
    } catch (error) {
        console.error('??Supabase 保�?失�?:', error.message);
        return false;
    }
}

/**
 * ?�新點數?�添?��???
 */
async function updateCheckinResult(currentPoints, earnedThisTime, status) {
    try {
        const data = await loadCheckinData();

        const timeStr = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

        // ?�新?��?
        data.current_points = currentPoints;
        data.earned_points = (data.earned_points || 0) + earnedThisTime;
        data.last_checkin = new Date().toISOString();
        data.status = status;

        // 添�?歷史記�?
        const newRecord = {
            time: timeStr,
            points: earnedThisTime > 0 ? `+${earnedThisTime}` : '+0',
            status: status
        };

        data.history = [newRecord, ...(data.history || [])].slice(0, 50);

        await saveCheckinData(data);

        console.log(`?? 點數已更?? ?��? ${currentPoints}, 累�??��? ${data.earned_points}`);
        return true;
    } catch (error) {
        console.error('???�新點數失�?:', error.message);
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
