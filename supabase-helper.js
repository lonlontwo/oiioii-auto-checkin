/**
 * Supabase ?¸æ??ä?æ¨¡ç?
 * è®€å¯?OiiOii ä¾¿ç•¶å°ˆå“¡?„ç°½?°æ•¸??
 */

const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_KEY, TABLE_NAME } = require('./supabase-config');

// ?å???Supabase å®¢æˆ¶ç«?
let supabase = null;

function getSupabase() {
    if (!supabase) {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('?”¥ Supabase å·²å?å§‹å?');
    }
    return supabase;
}

/**
 * è®€?–ç°½?°æ•¸??
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
                // è³‡æ?ä¸å??¨ï??µå»º?å?è³‡æ?
                console.log('?? Supabase ä¸­æ??‰æ•¸?šï??µå»º?å?è³‡æ?...');
                const defaultData = getDefaultData();
                await saveCheckinData(defaultData);
                return defaultData;
            }
            throw error;
        }

        console.log('?? å¾?Supabase è®€?–æ•¸?šæ???);
        return data;
    } catch (error) {
        console.error('??Supabase è®€?–å¤±??', error.message);
        return getDefaultData();
    }
}

/**
 * ä¿å?ç°½åˆ°?¸æ?
 */
async function saveCheckinData(data) {
    try {
        const client = getSupabase();

        // æ·»å??´æ–°?‚é?
        data.updated_at = new Date().toISOString();
        data.id = 1; // ?ºå? ID

        const { error } = await client
            .from(TABLE_NAME)
            .upsert(data, { onConflict: 'id' });

        if (error) throw error;

        console.log('?’¾ ?¸æ?å·²ä?å­˜åˆ° Supabase');
        return true;
    } catch (error) {
        console.error('??Supabase ä¿å?å¤±æ?:', error.message);
        return false;
    }
}

/**
 * ?´æ–°é»žæ•¸?Œæ·»? è???
 */
async function updateCheckinResult(currentPoints, earnedThisTime, status) {
    try {
        const data = await loadCheckinData();

        const timeStr = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

        // ?´æ–°?¸æ?
        data.current_points = currentPoints;
        data.earned_points = (data.earned_points || 0) + earnedThisTime;
        data.last_checkin = new Date().toISOString();
        data.status = status;

        // æ·»å?æ­·å²è¨˜é?
        const newRecord = {
            time: timeStr,
            points: earnedThisTime > 0 ? `+${earnedThisTime}` : '+0',
            status: status
        };

        data.history = [newRecord, ...(data.history || [])].slice(0, 50);

        await saveCheckinData(data);

        console.log(`?? é»žæ•¸å·²æ›´?? ?¶å? ${currentPoints}, ç´¯è??²å? ${data.earned_points}`);
        return true;
    } catch (error) {
        console.error('???´æ–°é»žæ•¸å¤±æ?:', error.message);
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
