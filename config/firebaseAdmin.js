// backend/config/firebaseAdmin.js

const admin = require('firebase-admin');

let serviceAccount;

// 1. 환경 변수(프로덕션/배포 환경)에서 인증 정보를 가져오는지 확인
if (process.env.FIREBASE_ADMIN_CREDENTIALS) {
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
    } catch (error) {
        throw new Error("FIREBASE_ADMIN_CREDENTIALS 환경변수 파싱 오류: " + error.message);
    }
} 
// 2. 환경 변수가 없으면 로컬 JSON 파일을 사용 (로컬 개발 환경)
else {
    try {
        // 'backend/config/' 디렉토리에 파일이 있는지 확인
        const serviceAccountRaw = require('./FIREBASE_ADMIN_CREDENTIALS.json');
        
        // JSON 객체를 문자열로 변환하여 process.env에 할당
        // 이 코드는 다음 실행을 위해 process.env를 설정하는 역할
        process.env.FIREBASE_ADMIN_CREDENTIALS = JSON.stringify(serviceAccountRaw);

        // 로컬 변수에 할당하여 현재 요청에서 사용
        serviceAccount = serviceAccountRaw;

        console.log("로컬 JSON 파일로 Firebase Admin SDK를 초기화합니다.");
    } catch (error) {
        throw new Error("로컬 FIREBASE_ADMIN_CREDENTIALS.json 파일을 찾을 수 없습니다: " + error.message);
    }
}

// 3. 인증 정보 객체가 준비되었는지 확인
if (!serviceAccount) {
    throw new Error("Firebase Admin SDK 초기화에 필요한 인증 정보가 없습니다.");
}

// 4. SDK 초기화
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

console.log("✅ Firebase Admin SDK가 성공적으로 초기화되었습니다.");

module.exports = { admin, db, auth };