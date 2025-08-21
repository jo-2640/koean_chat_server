// backend/config/env.js
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config({ path: '.env' });
}

const AZURE_STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const AZURE_STORAGE_ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const AZURE_CONTAINER_NAME = process.env.AZURE_CONTAINER_NAME || 'new';
const CLIENT_BASE_URL = process.env.CLIENT_BASE_URL || 'http://localhost:5173';
const SERVER_MIN_BIRTH_YEAR = parseInt(process.env.SERVER_MIN_BIRTH_YEAR, 10);
const SERVER_MAX_BIRTH_YEAR = parseInt(process.env.SERVER_MAX_BIRTH_YEAR, 10);
const FIREBASE_ADMIN_CREDENTIALS = process.env.FIREBASE_ADMIN_CREDENTIALS;
console.log('--- Vercel 환경 변수 디버깅 ---');
console.log('NODE_ENV:', process.env.NODE_ENV); // 'production'으로 나와야 함
console.log('AZURE_STORAGE_ACCOUNT_NAME 인식 여부:', !!AZURE_STORAGE_ACCOUNT_NAME);
console.log('AZURE_STORAGE_ACCOUNT_KEY 인식 여부:', !!AZURE_STORAGE_ACCOUNT_KEY);
console.log('-----------------------------');
// 중요 환경 변수에 대한 기본적인 유효성 검사
if (!AZURE_STORAGE_ACCOUNT_NAME || !AZURE_STORAGE_ACCOUNT_KEY) {
    console.error("ERROR: AZURE_STORAGE_ACCOUNT_NAME 또는 AZURE_STORAGE_ACCOUNT_KEY가 .env 파일에 설정되지 않았습니다.");
    process.exit(1);
}

// 로드된 변수 로그 (보안을 위해 키의 일부만 표시)
console.log("로드된 AZURE_STORAGE_ACCOUNT_NAME:", AZURE_STORAGE_ACCOUNT_NAME);
console.log("로드된 AZURE_STORAGE_ACCOUNT_KEY (앞 5자리):", AZURE_STORAGE_ACCOUNT_KEY ? AZURE_STORAGE_ACCOUNT_KEY.substring(0, 5) + '...' : '로드되지 않음');
console.log("로드된 AZURE_CONTAINER_NAME:", AZURE_CONTAINER_NAME);
console.log("로드된 CLIENT_BASE_URL:", CLIENT_BASE_URL);
console.log("로드된 SERVER_MIN_BIRTH_YEAR:",SERVER_MIN_BIRTH_YEAR);
console.log("로드된 SERVER_MAX_BIRTH_YEAR:",SERVER_MAX_BIRTH_YEAR);

module.exports = {
    AZURE_STORAGE_ACCOUNT_NAME,
    AZURE_STORAGE_ACCOUNT_KEY,
    AZURE_CONTAINER_NAME,
    CLIENT_BASE_URL,
    SERVER_MIN_BIRTH_YEAR: Number.isInteger(SERVER_MIN_BIRTH_YEAR) ? SERVER_MIN_BIRTH_YEAR : 1950,
    SERVER_MAX_BIRTH_YEAR: Number.isInteger(SERVER_MAX_BIRTH_YEAR) ? SERVER_MAX_BIRTH_YEAR : new Date().getFullYear(),
    FIREBASE_ADMIN_CREDENTIALS,
};