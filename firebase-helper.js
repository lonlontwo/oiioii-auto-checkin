/**
 * Firebase 數據操作模組
 * 讀寫 OiiOii 便當專員的簽到數據
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion, Timestamp } = require('firebase/firestore');
const { firebaseConfig, COLLECTION_NAME } = require('./firebase-config');

// 初始化 Firebase
let app = null;
let db = null;

function initFirebase() {
    if (!app) {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        console.log('🔥 Firebase 已初始化');
    }
    return db;
}

// 文檔 ID
const DOC_ID = 'checkin-status';

/**
 * 讀取簽到數據
 */
async function loadCheckinData() {
    try {
        const db = initFirebase();
        const docRef = doc(db, COLLECTION_NAME, DOC_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            console.log('📖 從 Firebase 讀取數據成功');
            return docSnap.data();
        } else {
            console.log('📖 Firebase 中沒有數據，使用預設值');
            return getDefaultData();
        }
    } catch (error) {
        console.error('❌ Firebase 讀取失敗:', error.message);
        return getDefaultData();
    }
}

/**
 * 保存簽到數據
 */
async function saveCheckinData(data) {
    try {
        const db = initFirebase();
        const docRef = doc(db, COLLECTION_NAME, DOC_ID);

        // 添加更新時間
        data.updatedAt = Timestamp.now();

        await setDoc(docRef, data, { merge: true });
        console.log('💾 數據已保存到 Firebase');
        return true;
    } catch (error) {
        console.error('❌ Firebase 保存失敗:', error.message);
        return false;
    }
}

/**
 * 添加簽到記錄
 */
async function addCheckinRecord(record) {
    try {
        const db = initFirebase();
        const docRef = doc(db, COLLECTION_NAME, DOC_ID);

        await updateDoc(docRef, {
            history: arrayUnion({
                ...record,
                timestamp: Timestamp.now()
            }),
            lastCheckin: Timestamp.now()
        });

        console.log('📝 簽到記錄已添加');
        return true;
    } catch (error) {
        console.error('❌ 添加記錄失敗:', error.message);
        return false;
    }
}

/**
 * 更新點數
 */
async function updatePoints(currentPoints, earnedPoints) {
    try {
        const db = initFirebase();
        const docRef = doc(db, COLLECTION_NAME, DOC_ID);

        await updateDoc(docRef, {
            currentPoints: currentPoints,
            earnedPoints: earnedPoints,
            updatedAt: Timestamp.now()
        });

        console.log(`📊 點數已更新: 當前 ${currentPoints}, 已獲得 ${earnedPoints}`);
        return true;
    } catch (error) {
        console.error('❌ 更新點數失敗:', error.message);
        return false;
    }
}

function getDefaultData() {
    return {
        currentPoints: 0,
        earnedPoints: 0,
        lastCheckin: null,
        status: 'pending',
        history: []
    };
}

module.exports = {
    initFirebase,
    loadCheckinData,
    saveCheckinData,
    addCheckinRecord,
    updatePoints
};
