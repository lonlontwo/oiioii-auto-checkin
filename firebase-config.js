/**
 * Firebase 配置
 * 用於存儲 OiiOii 簽到數據
 */

// Firebase 配置 - 請填入你的 Firebase 專案資訊
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "YOUR_API_KEY",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT.appspot.com",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
    appId: process.env.FIREBASE_APP_ID || "YOUR_APP_ID"
};

// Firestore 集合名稱
const COLLECTION_NAME = 'oiioii便當專員';

module.exports = {
    firebaseConfig,
    COLLECTION_NAME
};
