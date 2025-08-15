// D:\My Project Flutter\chat_app\assets\ChatHtml\backend\server.js
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, 'config','.env') });

console.log("Loaded AZURE_STORAGE_ACCOUNT_NAME:", process.env.AZURE_STORAGE_ACCOUNT_NAME);
console.log("Loaded AZURE_STORAGE_ACCOUNT_KEY (first 5 chars):", process.env.AZURE_STORAGE_ACCOUNT_KEY ? process.env.AZURE_STORAGE_ACCOUNT_KEY.substring(0, 5) + '...' : 'Not loaded');
console.log("Loaded AZURE_CONTAINER_NAME:", process.env.AZURE_CONTAINER_NAME);

const express = require('express');
const { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob');
const cors = require('cors');

const app = express();

const CLIENT_BASE_URL = process.env.CLIENT_BASE_URL || 'http://localhost:5173';
const port = process.env.PORT || 3000;
// Firebase 초기화
const admin = require('firebase-admin');
const serviceAccount = require('./config/simplechat.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// --- CORS 설정 ---
const corsOptions = {
    origin: `${CLIENT_BASE_URL}`, // 당신의 프론트엔드 (Vite) 개발 서버 주소
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    credentials: true,
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.use(express.json());

// --- Azure Storage 설정 ---
const AZURE_STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const AZURE_STORAGE_ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const AZURE_CONTAINER_NAME = process.env.AZURE_CONTAINER_NAME || 'new'; // Default to 'new' if not set

if (!AZURE_STORAGE_ACCOUNT_NAME || !AZURE_STORAGE_ACCOUNT_KEY || !AZURE_CONTAINER_NAME) {
    console.error("ERROR: Azure Storage Account Name, Key, or Container Name not set in .env");
    process.exit(1);
}

const sharedKeyCredential = new StorageSharedKeyCredential(
    AZURE_STORAGE_ACCOUNT_NAME,
    AZURE_STORAGE_ACCOUNT_KEY
);

const blobServiceClient = new BlobServiceClient(
    `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
    sharedKeyCredential
);
const containerClient = blobServiceClient.getContainerClient(AZURE_CONTAINER_NAME);

async function ensureContainerExists() {
    try {
        await containerClient.createIfNotExists();
        console.log(`Azure Blob Container '${AZURE_CONTAINER_NAME}' 준비 완료.`);
    } catch (error) {
        console.error("ERROR: Azure Blob Container 생성 또는 확인 중 오류:", error);
        process.exit(1);
    }
}
ensureContainerExists();


// ⭐⭐⭐ 중요 수정: getDefaultProfileImageUrl 함수를 클라이언트의 전체 URL을 반환하도록 변경 ⭐⭐⭐
// 클라이언트 (Vite 개발 서버)의 주소를 직접 참조합니다.


function getDefaultProfileImageUrl(gender) {
    if (gender === 'male') {
        return `${CLIENT_BASE_URL}/img/default_profile_male.png`; // 클라이언트의 `public/img` 경로에 맞게 수정
    } else if (gender === 'female') {
        return `${CLIENT_BASE_URL}/img/default_profile_female.png`; // 클라이언트의 `public/img` 경로에 맞게 수정
    }
    return `${CLIENT_BASE_URL}/img/default_profile_guest.png`; // 클라이언트의 `public/img` 경로에 맞게 수정
}
// D:\My Project Flutter\chat_app\assets\ChatHtml\backend\server.js

// ... (기존 require, express, firebase 초기화, Azure 설정 등 유지) ...

app.get('/api/getBirthYearRange',(req, res) => {

    // SERVER_MIN_BIRTH_YEAR 처리
    const envMinYear = parseInt(process.env.SERVER_MIN_BIRTH_YEAR, 10);
    if (Number.isInteger(envMinYear)) {
        minYear = envMinYear;
    } else {
        minYear = 1950; // 환경 변수가 유효하지 않으면 기본값 사용
        console.warn(`SERVER_MIN_BIRTH_YEAR 환경 변수 값이 유효하지 않습니다. 기본값 ${minYear} 사용.`);
    }

    // SERVER_MAX_BIRTH_YEAR 처리
    const envMaxYear = parseInt(process.env.SERVER_MAX_BIRTH_YEAR, 10);
    if (Number.isInteger(envMaxYear)) {
        maxYear = envMaxYear;
    } else {
        maxYear = new Date().getFullYear(); // 환경 변수가 유효하지 않으면 현재 연도 사용
        console.warn(`SERVER_MAX_BIRTH_YEAR 환경 변수 값이 유효하지 않습니다. 기본값 ${maxYear} 사용.`);
    }

    res.status(200).json({success: true,
        minBirthYear: minYear,
        maxBirthYear: maxYear
    });
});
// 회원가입 API 엔드포인트 추가 (또는 기존 회원가입 로직에 삽입)
app.post('/api/signup', async (req, res) => {
    try {
        const { email, password, nickname, birthYear, region, gender, minAgeGroup, maxAgeGroup, bio, profileImgUrl } = req.body;
        const MIN_BIRTH_YEAR = parseInt(process.env.SERVER_MIN_BIRTH_YEAR) || 1950;
        const MAX_BIRTH_YEAR = parseInt(process.env.SERVER_MAX_BIRTH_YEAR) || 2010;
        
        console.log('서버: 회원가입 요청 받음:', { email, nickname, birthYear, gender });

        // ⭐⭐ 서버 측 필수 필드 유효성 검사 (문법 오류 수정) ⭐⭐
        if (!nickname || !email || !password || !region || !gender || !birthYear ||
            minAgeGroup === undefined || minAgeGroup === null || minAgeGroup === '' || 
            maxAgeGroup === undefined || maxAgeGroup === null || maxAgeGroup === '') {
            console.warn("서버: 필수 회원가입 필드 누락.");
            return res.status(400).json({ 
                success: false, 
                message: '닉네임, 이메일, 비밀번호, 지역, 성별, 출생연도, 관심 나이대는 필수 입력 항목입니다.' 
            });
        }

        // 비밀번호 길이 검증
        if (password.length < 6) {
            console.warn("서버: 비밀번호가 너무 짧습니다.");
            return res.status(400).json({ 
                success: false, 
                message: '비밀번호는 6자 이상이어야 합니다.' 
            });
        }

        // ⭐⭐⭐ nickname 검증: 2글자 이상 ⭐⭐⭐
        if (!nickname || nickname.trim().length < 2) {
            console.warn("서버: 닉네임이 2글자 미만입니다:", nickname);
            return res.status(400).json({
                success: false,  
                message: '닉네임은 2글자 이상이어야 합니다.' 
            });
        }

        // 닉네임 최대 길이 제한 (추가)
        if (nickname.trim().length > 20) {
            console.warn("서버: 닉네임이 20글자를 초과합니다:", nickname);
            return res.status(400).json({
                success: false,  
                message: '닉네임은 20글자 이하여야 합니다.' 
            });
        }
  
        // ⭐⭐⭐ birthYear 검증: 범위 내 숫자 ⭐⭐⭐
        const birthYearNum = parseInt(birthYear);
  
        if (!birthYear || isNaN(birthYearNum)) {
            console.warn("서버: 유효하지 않은 출생연도:", birthYear);
            return res.status(400).json({
                success: false,
                message: '올바른 출생연도를 입력해주세요.' 
            });
        } 
  
        if (birthYearNum < MIN_BIRTH_YEAR || birthYearNum > MAX_BIRTH_YEAR) {
            console.warn(`서버: 출생연도가 범위를 벗어남: ${birthYearNum} (범위: ${MIN_BIRTH_YEAR}-${MAX_BIRTH_YEAR})`);
            return res.status(400).json({ 
                success: false, 
                message: `출생연도는 ${MIN_BIRTH_YEAR}년 이상 ${MAX_BIRTH_YEAR}년 이하여야 합니다.`
            });
        }

        // 나이대 검증 (개선)
        const minVal = parseInt(minAgeGroup.split('-')[0]);
        const maxVal = parseInt(maxAgeGroup.split('-')[0]);
        if (isNaN(minVal) || isNaN(maxVal)) {
            console.warn("서버: 유효하지 않은 나이대 형식:", { minAgeGroup, maxAgeGroup });
            return res.status(400).json({ 
                success: false, 
                message: '올바른 나이대 형식을 선택해주세요.' 
            });
        }

        if (minVal > maxVal) {
            console.warn("서버: 최소 나이대가 최대 나이대보다 큽니다:", { minVal, maxVal });
            return res.status(400).json({ 
                success: false, 
                message: '최소 나이대는 최대 나이대보다 클 수 없습니다.' 
            });
        }
        
        // 이메일 형식 검사 (정규식 개선)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.warn("서버: 유효하지 않은 이메일 형식:", email);
            return res.status(400).json({ 
                success: false, 
                message: '유효하지 않은 이메일 주소 형식입니다.' 
            });
        }

        // 성별 검증 (추가)
        if (!['male', 'female'].includes(gender)) {
            console.warn("서버: 유효하지 않은 성별:", gender);
            return res.status(400).json({ 
                success: false, 
                message: '올바른 성별을 선택해주세요.' 
            });
        }

        // bio 길이 제한 (추가)
        if (bio && bio.length > 500) {
            console.warn("서버: 자기소개가 너무 깁니다:", bio.length);
            return res.status(400).json({ 
                success: false, 
                message: '자기소개는 500자 이하여야 합니다.' 
            });
        }

        console.log("서버: 모든 검증 통과, Firebase 사용자 생성 시작");

        // Firebase Auth를 이용한 사용자 생성
        const userRecord = await admin.auth().createUser({
            email: email.trim(),
            password: password,
            displayName: nickname.trim(),
            photoURL: profileImgUrl || getDefaultProfileImageUrl(gender)
        });

        const uid = userRecord.uid;
        console.log(`서버: Firebase 사용자 생성 성공: ${uid}`);

        // Firestore에 사용자 추가 데이터 저장
        await admin.firestore().collection('users').doc(uid).set({
            nickname: nickname.trim(),
            email: email.trim(),
            birthYear: birthYearNum, // 숫자로 저장
            region: region.trim(),
            gender: gender,
            minAgeGroup: minAgeGroup,
            maxAgeGroup: maxAgeGroup,
            profileImgUrl: profileImgUrl || getDefaultProfileImageUrl(gender),
            bio: bio ? bio.trim() : '', // bio가 있으면 trim, 없으면 빈 문자열
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(), // 추가
            friendIds: [],
            friendRequestsSent: [],
            friendRequestsReceived: []
        });

        console.log(`서버: 새 사용자 계정 생성 및 Firestore 저장 성공: ${uid}`);
        return res.status(200).json({ 
            success: true, 
            message: '회원가입이 완료되었습니다!', 
            uid: uid 
        });

    } catch (error) {
        console.error("서버: 회원가입 중 오류 발생:", error);
        
        // Firebase Auth 에러 코드별 처리
        let errorMessage = '회원가입 중 오류가 발생했습니다.';
        
        if (error.code === 'auth/email-already-exists') {
            errorMessage = '이미 사용 중인 이메일 주소입니다.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = '유효하지 않은 이메일 주소입니다.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = '비밀번호가 너무 약합니다 (최소 6자).';
        } else if (error.code === 'auth/invalid-password') {
            errorMessage = '유효하지 않은 비밀번호입니다.';
        } else if (error.code === 'auth/invalid-display-name') {
            errorMessage = '유효하지 않은 닉네임입니다.';
        }
        
        return res.status(500).json({ 
            success: false, 
            message: errorMessage, 
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ... (다른 엔드포인트 및 서버 시작 로직 유지) ...

// --- SAS 토큰 생성 API 엔드포인트 (기존과 동일) ---
app.post('/api/getBlobSasToken', async (req, res) => {
    console.log("SAS 토큰 생성 요청 받음, 요청 본문:", req.body);
    try {
        const { fileName, contentType } = req.body;
        
        console.log(`서버: SAS 토큰 요청을 위한 클라이언트 fileName: ${fileName}, Content-Type: ${contentType}`);
        if (!fileName || !contentType) {
            return res.status(400).json({ success: false, message: 'File name and content type are required.' });
        }

        const sasOptions = {
            containerName: AZURE_CONTAINER_NAME,
            blobName: fileName,
            permissions: BlobSASPermissions.from({ write: true, create: true, read: true, add: true }),
            startsOn: new Date(new Date().valueOf() - (10 * 1000)), // Start 10 seconds ago
            expiresOn: new Date(new Date().valueOf() + (5 * 60 * 1000)), // Valid for 5 minutes
        };
         console.log(`서버: SAS 토큰 생성에 사용될 blobName: ${sasOptions.blobName}`);        
        const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();
        console.log(`SAS 토큰 생성 성공 - 파일명: ${fileName}, 토큰: ${sasToken.substring(0, 30)}...`); // Truncate token for log

        const blobUrl = `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${AZURE_CONTAINER_NAME}/${fileName}`;

        res.status(200).json({
            success: true,
            storageAccountUrl: `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
            containerName: AZURE_CONTAINER_NAME,
            sasToken: sasToken,
            blobUrl: blobUrl
        });
    } catch (error) {
        console.error('SAS Token generation error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate SAS token.', error: error.message });
    }
});

app.post('/api/getProfileImageUrl', async (req, res) => {
    console.log("백엔드: 프로필 이미지 url 요청받음, 요청 본문:", req.body);
    const { userId, requestorUid } = req.body;

    const MAX_RETRIES = 3; // 최대 3번 재시도
    const RETRY_DELAY_MS = 500; // 500ms (0.5초) 지연 후 재시도

    try {
        if (!userId || !requestorUid) {
            return res.status(400).json({ success: false, message: 'User ID and Requestor UID are required.' });
        }

        let userDoc = null;
        for (let i = 0; i < MAX_RETRIES; i++) {
            const userDocRef = db.collection('users').doc(userId);
            userDoc = await userDocRef.get();

            console.log(`백엔드: [시도 ${i + 1}/${MAX_RETRIES}] Firestore 문서 조회 결과 (userId: ${userId})`);
            console.log(`백엔드: userDoc.exists: ${userDoc.exists}`);

            if (userDoc.exists) {
                const userData = userDoc.data();
                console.log(`백엔드: userDoc.data(): ${JSON.stringify(userData)}`);
                console.log(`백엔드: profileImgUrl from Firestore: ${userData.profileImgUrl}`);
                break; // 문서를 찾았으면 루프 종료
            } else {
                console.warn(`백엔드: User document for ${userId} not found on attempt ${i + 1}. Retrying in ${RETRY_DELAY_MS}ms...`);
                if (i < MAX_RETRIES - 1) { // 마지막 시도가 아니면 지연
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                }
            }
        }

        // 모든 재시도 후에도 문서가 여전히 없으면
        if (!userDoc || !userDoc.exists) {
            console.warn(`백엔드: User document for ${userId} still not found after ${MAX_RETRIES} retries. Returning default image.`);
            return res.status(200).json({ success: true, imageUrl: getDefaultProfileImageUrl(null) }); // ⭐ 수정된 함수 사용
        }

        const userData = userDoc.data();
        const storedProfileImgUrl = userData.profileImgUrl;

        // ⭐⭐⭐ 중요 수정: Azure Blob Storage URL이 아닌 경우에도 올바른 URL 반환 ⭐⭐⭐
        if (!storedProfileImgUrl || !storedProfileImgUrl.includes(AZURE_STORAGE_ACCOUNT_NAME)) {
            console.log(`백엔드: Non-Azure or default profile image for ${userId}: ${storedProfileImgUrl}. Returning as is.`);
            // 저장된 URL이 Azure URL이 아닌 경우 해당 URL을 반환하거나, 없으면 기본 이미지 생성
            return res.status(200).json({ success: true, imageUrl: storedProfileImgUrl || getDefaultProfileImageUrl(userData.gender) });
        }

        const urlParts = storedProfileImgUrl.split('/');
        // AZURE_BLOB_STORAGE_BASE_URL은 필요에 따라 여기에 정의하거나 전역으로 정의할 수 있습니다.
        const AZURE_BLOB_STORAGE_BASE_URL = `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${AZURE_CONTAINER_NAME}/`;

        // 컨테이너 이름이 URL에서 발견되지 않는 경우 `urlParts.indexOf(AZURE_CONTAINER_NAME)`를 올바르게 처리해야 합니다.
        const containerIndex = urlParts.indexOf(AZURE_CONTAINER_NAME);
        if (containerIndex === -1) {
            console.warn(`백엔드: Container name '${AZURE_CONTAINER_NAME}' not found in stored URL: ${storedProfileImgUrl}. Returning default image.`);
            return res.status(200).json({ success: true, imageUrl: getDefaultProfileImageUrl(userData.gender) });
        }
        const blobName = urlParts.slice(containerIndex + 1).join('/');

        let finalImageUrl;
        let hasAccess = false;

        // 접근 제어 로직
        if (userId === requestorUid) {
            hasAccess = true;
            console.log(`백엔드: Access granted: ${userId} is self.`);
        } else {
            const requestorDoc = await db.collection('users').doc(requestorUid).get();
            const requestorData = requestorDoc.data();
            if (requestorData && requestorData.friendIds && requestorData.friendIds.includes(userId)) {
                hasAccess = true;
                console.log(`백엔드: Access granted: ${userId} is friend of ${requestorUid}.`);
            } else {
                console.log(`백엔드: Access denied: ${userId} is not self or friend of ${requestorUid}.`);
            }
        }

        if (hasAccess) {
            const now = new Date();
            const tenSecondsAgo = new Date(now.valueOf() - (10 * 1000));
            const fifteenMinutesLater = new Date(now.valueOf() + (15 * 60 * 1000));

            const sasOptions = {
                containerName: AZURE_CONTAINER_NAME,
                blobName: blobName,
                permissions: BlobSASPermissions.from({ read: true }),
                startsOn: tenSecondsAgo,
                expiresOn: fifteenMinutesLater,
            };
            const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();
            finalImageUrl = `${storedProfileImgUrl}?${sasToken}`;
            console.log(`백엔드: SAS URL generated for ${userId}: ${finalImageUrl.substring(0, 100)}...`); // 로그를 위해 URL 길이 잘라 출력
        } else {
            finalImageUrl = getDefaultProfileImageUrl(userData.gender); // ⭐ 수정된 함수 사용
            console.log(`백엔드: Returning default image for ${userId} due to no access.`);
        }
        res.status(200).json({ success: true, imageUrl: finalImageUrl });
    } catch (error) {
        console.error('백엔드: Error fetching profile image URL:', error);
        res.status(500).json({ success: false, message: 'Failed to get profile image URL.', error: error.message });
    }
});


app.get('/api/current-year', (req, res) => {
    const currentYear = new Date().getFullYear();
    res.json({ currentYear: currentYear});
});


// --- Firebase Admin SDK를 이용한 삭제 함수들 (기존과 동일) ---
async function deleteAllAuthUsers() {
    let uids = [];
    let nextPageToken;
    do {
        const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);
        uids = uids.concat(listUsersResult.users.map(user => user.uid));
        nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);

    if (uids.length > 0) {
        const BATCH_SIZE = 1000;
        let totalDeleted = 0;
        for (let i = 0; i < uids.length; i += BATCH_SIZE) {
            const batchUids = uids.slice(i, i + BATCH_SIZE);
            
            // ⭐⭐⭐ 추가된 부분: deleteUsers 결과 확인 및 에러 처리 ⭐⭐⭐
            const deleteResult = await admin.auth().deleteUsers(batchUids);
            if (deleteResult.errors && deleteResult.errors.length > 0) {
                console.error(`Error deleting batch of users:`, deleteResult.errors);
                // 특정 오류가 발생하면, 이 함수 밖으로 오류를 던져서 `/delete-all-data` 엔드포인트의 catch 블록에서 처리되도록 합니다.
                throw new Error(`사용자 배치 삭제 중 ${deleteResult.errors.length}개의 오류 발생. 첫 번째 오류: ${deleteResult.errors[0].message}`);
            }
            console.log(`Deleted batch of ${batchUids.length} users. Processed ${deleteResult.successCount} successfully.`);
            totalDeleted += deleteResult.successCount; // 실제로 성공적으로 삭제된 사용자 수만 카운트
        }
        return totalDeleted; // 성공적으로 삭제된 사용자 수 반환
    }
    return 0; // 삭제할 사용자 없음
}

async function deleteCollection(collectionPath, batchSize = 500) {
    const collectionRef = admin.firestore().collection(collectionPath);
    const query = collectionRef.limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(query, resolve).catch(reject);
    });

    async function deleteQueryBatch(query, resolve) {
        const snapshot = await query.get();

        if (snapshot.size === 0) {
            resolve();
            return;
        }

        const batch = admin.firestore().batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        process.nextTick(() => {
            deleteQueryBatch(query, resolve);
        });
    }
}

app.post('/api/delete-all-data', async (req, res) => {
    try {
        console.log('API call received: /delete-all-data');

        console.log('Deleting all Authentication users...');
        const authUsersDeleted = await deleteAllAuthUsers(); // ⭐ 반환값 사용
        console.log(`${authUsersDeleted} Authentication users deleted.`);

        console.log('Deleting all Firestore collections...');
        const collectionsToDelete = ['users', 'userProfiles', 'conversations']; 

        for (const collectionName of collectionsToDelete) {
            console.log(`Deleting collection: ${collectionName}`);
            await deleteCollection(collectionName);
            console.log(`Collection ${collectionName} deleted.`);
        }

        // 성공 시 응답
        res.status(200).json({ success: true, message: `총 ${authUsersDeleted}명의 사용자와 지정된 모든 Firestore 컬렉션이 삭제되었습니다.` });

    } catch (error) {
        // 오류 발생 시 클라이언트에 500 응답 반환
        console.error("Error deleting all user data from API:", error);
        res.status(500).json({ success: false, message: `데이터 삭제 중 오류 발생: ${error.message}` });
    }
});

// --- 서버 시작 ---
app.listen(port, () => {
    console.log(`Node.js 서버가 http://localhost:${port} 에서 실행 중입니다.`);
    console.log(`모든 데이터 삭제 엔드포인트: POST http://localhost:${port}/delete-all-data`);
});