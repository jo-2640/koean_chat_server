// backend/config/firebaseAdmin.js
const admin = require('firebase-admin');
const { FIREBASE_ADMIN_CREDENTIALS } = require('./env');

// 환경 변수에서 JSON 문자열을 가져옵니다.
const serviceAccountString = process.env.FIREBASE_ADMIN_CREDENTIALS;

if (!serviceAccountString) {
    throw new Error("FIREBASE_ADMIN_CREDENTIALS 환경변수가 설정되지 않았습니다.");
}

// JSON 문자열을 JavaScript 객체로 파싱합니다.
let serviceAccount;
try {
    serviceAccount = JSON.parse(serviceAccountString);
} catch (error) {
    throw new Error("FIREBASE_ADMIN_CREDENTIALS 환경변수 파싱 오류: " + error.message);
}

// 파싱된 객체를 사용하여 Firebase Admin SDK를 초기화합니다.
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

console.log("Firebase Admin SDK가 초기화되었습니다.");

module.exports = { admin, db, auth };