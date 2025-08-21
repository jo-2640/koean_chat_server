// backend/routes/authRoutes.js

const express = require('express');
const router = express.Router();

// 필요한 라이브러리 및 유틸리티 함수들을 불러옵니다.
const { db, admin, auth } = require('../config/firebaseAdmin');
const { getDefaultProfileImageUrl } = require('../config/defaultImages');
const { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob');

// 환경 변수 설정
const AZURE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const AZURE_ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const AZURE_CONTAINER_NAME = process.env.AZURE_CONTAINER_NAME;

router.get('/test-connection', (req, res) => {
    console.log("서버: /test-connection 요청을 받았습니다!");
    res.status(200).json({
        success: true,
        message: "연결 성공!"
    });
});

// Azure 환경 변수 누락 시 서버 오류 처리
if (!AZURE_ACCOUNT_NAME || !AZURE_ACCOUNT_KEY || !AZURE_CONTAINER_NAME) {
    console.error("Critical Error: Azure Storage Account Name, Key, or Container Name is not set in environment variables.");
    router.use((req, res) => {
        res.status(500).json({ success: false, message: '서버 설정 오류: Azure 환경 변수가 설정되지 않았습니다.' });
    });
} else {
    // 1. 사용자 계정 생성 (현재 미사용)
    router.post('/signup/create-user', async (req, res) => {
        try {
            const { email, password, gender, nickname } = req.body;
            if (!email || !password || !gender || !nickname) {
                return res.status(400).json({ success: false, message: '이메일, 비밀번호, 닉네임, 성별은 필수 입력 항목입니다.' });
            }
            const userRecord = await auth.createUser({
                email: email.trim(),
                password: password,
                displayName: nickname.trim(),
                photoURL: getDefaultProfileImageUrl(gender)
            });
            const uid = userRecord.uid;
            console.log(`서버: Firebase 사용자 생성 성공 - UID: ${uid}`);
            return res.status(200).json({ success: true, message: '사용자 계정이 성공적으로 생성되었습니다.', uid: uid });
        } catch (error) {
            console.error("서버: 사용자 계정 생성 중 오류 발생:", error);
            if (error.code === 'auth/email-already-exists') {
                return res.status(409).json({ success: false, message: '이미 사용 중인 이메일 주소입니다.' });
            }
            return res.status(500).json({ success: false, message: '계정 생성 중 오류가 발생했습니다.' });
        }
    });

    // 2. 프로필 이미지 업로드용 SAS 토큰 발급
    router.post('/signup/get-profile-sas-token', async (req, res) => {
        const { uid, blobPath } = req.body;
        if (!uid || !blobPath) {
            return res.status(400).json({ success: false, message: 'UID와 파일명이 필요합니다.' });
        }
        try {
            const sharedKeyCredential = new StorageSharedKeyCredential(AZURE_ACCOUNT_NAME, AZURE_ACCOUNT_KEY);
            const blobServiceClient = new BlobServiceClient(`https://${AZURE_ACCOUNT_NAME}.blob.core.windows.net`, sharedKeyCredential);
            const containerClient = blobServiceClient.getContainerClient(AZURE_CONTAINER_NAME);
            const blobName = blobPath;
            const writeSasOptions = {
                containerName: AZURE_CONTAINER_NAME,
                blobName: blobName,
                permissions: BlobSASPermissions.from({ create: true, write: true }),
                expiresOn: new Date(new Date().valueOf() + 300 * 1000)
            };
            const writeSasToken = generateBlobSASQueryParameters(writeSasOptions, sharedKeyCredential).toString();
            const readSasOptions = {
                containerName: AZURE_CONTAINER_NAME,
                blobName: blobName,
                permissions: BlobSASPermissions.from({ read: true }),
                expiresOn: new Date(new Date().valueOf() + 300 * 1000)
            };
            const readSasToken = generateBlobSASQueryParameters(readSasOptions, sharedKeyCredential).toString();
            const blobUrl = containerClient.getBlobClient(blobName).url;
            console.log(`서버: UID ${uid}에 대한 SAS 토큰 발급 성공`);
            return res.status(200).json({
                success: true,
                message: 'SAS 토큰이 성공적으로 발급되었습니다.읽기/쓰기',
                writeSasToken: writeSasToken,
                readSasToken: readSasToken,
                blobUrl: blobUrl
            });
        } catch (error) {
            console.error("서버: SAS 토큰 발급 중 오류 발생:", error);
            return res.status(500).json({ success: false, message: 'SAS 토큰 발급 중 오류가 발생했습니다.' });
        }
    });

    // Firestore에 토큰확인후 ,azure storage에 토큰을 받아서 프로필 이미지 업로드
    router.post('/signup/get-profile-sas-token-for-app', async (req, res) => {
        // 1. 요청 헤더에서 인증 토큰을 추출합니다.
        const idToken = req.headers.authorization?.split('Bearer ')[1];
        if (!idToken) {
            return res.status(401).json({ success: false, message: '인증 토큰이 누락되었습니다.' });
        }

        try {
            // 2. Firebase Admin SDK로 토큰을 검증합니다.
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            const requestUid = decodedToken.uid;

            // 3. 클라이언트가 보낸 uid와 토큰의 uid가 일치하는지 확인합니다.
            const { uid, blobPath } = req.body;
            if (requestUid !== uid) {
                console.warn(`서버: 토큰 UID 불일치 - 토큰: ${requestUid}, 요청: ${uid}`);
                return res.status(403).json({ success: false, message: '토큰 UID와 요청 UID가 일치하지 않습니다.' });
            }
            
            if (!uid || !blobPath) {
                return res.status(400).json({ success: false, message: 'UID와 파일명이 필요합니다.' });
            }
            
            // 4. Azure Storage SDK를 사용하여 SAS 토큰을 생성합니다.
            const sharedKeyCredential = new StorageSharedKeyCredential(AZURE_ACCOUNT_NAME, AZURE_ACCOUNT_KEY);
            const blobServiceClient = new BlobServiceClient(
                `https://${AZURE_ACCOUNT_NAME}.blob.core.windows.net`,
                sharedKeyCredential
            );
            const containerClient = blobServiceClient.getContainerClient(AZURE_CONTAINER_NAME);

            const writeSasOptions = {
                containerName: AZURE_CONTAINER_NAME,
                blobName: blobPath,
                permissions: BlobSASPermissions.from({ create: true, write: true }),
                expiresOn: new Date(new Date().valueOf() + 300 * 1000) // 5분
            };
            const writeSasToken = generateBlobSASQueryParameters(writeSasOptions, sharedKeyCredential).toString();
            
            const blobUrl = containerClient.getBlobClient(blobPath).url;

            console.log(`서버: UID ${uid}에 대한 SAS 토큰 발급 성공`);
            
            // 5. 생성된 정보를 클라이언트에 응답합니다.
            return res.status(200).json({
                success: true,
                message: 'SAS 토큰이 성공적으로 발급되었습니다.',
                writeSasToken: writeSasToken,
                blobUrl: blobUrl
            });

        } catch (error) {
            console.error("서버: SAS 토큰 발급 중 오류 발생:", error);
            if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
                return res.status(401).json({ success: false, message: '인증 토큰이 유효하지 않습니다.' });
            }
            return res.status(500).json({ success: false, message: 'SAS 토큰 발급 중 오류가 발생했습니다.' });
        }
});
    // 3. Firestore에 최종 정보 저장 라우터
    router.post('/signup/finalize-all', async (req, res) => {
        try {
            const { uid, nickname, birthYear, region, gender, minAgeGroup, maxAgeGroup, bio, profileImgUrl } = req.body;
            if (!uid || !nickname || !birthYear || !region || !gender || minAgeGroup === undefined || maxAgeGroup === undefined) {
                return res.status(400).json({ success: false, message: '필수 정보가 누락되었습니다.' });
            }
            await auth.updateUser(uid, {
                displayName: nickname.trim(),
                photoURL: profileImgUrl
            });
            await db.collection('users').doc(uid).set({
                nickname: nickname.trim(),
                birthYear: parseInt(birthYear),
                region: region.trim(),
                gender: gender,
                minAgeGroup: minAgeGroup,
                maxAgeGroup: maxAgeGroup,
                profileImgUrl: profileImgUrl,
                bio: bio ? bio.trim() : '',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                friendIds: [],
                friendRequestsSent: [],
                friendRequestsReceived: []
            });
            console.log(`서버: Firestore에 최종 사용자 정보 저장 성공 - UID: ${uid}`);
            return res.status(200).json({
                success: true,
                message: '회원가입이 완료되었습니다!',
            });
        } catch (error) {
            console.error("서버: 최종 데이터 저장 중 오류 발생:", error);
            return res.status(500).json({ success: false, message: '최종 데이터 저장 중 오류가 발생했습니다.' });
        }
    });

    // 4. 여러 사용자의 프로필 이미지 읽기용 SAS 토큰 발급 (수정 완료)
    router.post('/get-multiple-sas-tokens', async (req, res) => {
        // ✅ uids 배열 대신, uid와 blobPath를 포함하는 객체 배열을 받도록 변경
        const { users } = req.body;
        console.log("클라이언트가 보낸 사용자 정보:", req.body.users);
        if (!users || !Array.isArray(users) || users.length === 0) {
            return res.status(400).json({ success: false, message: '유효한 사용자 정보 배열이 필요합니다.' });
        }
        try {
            const sharedKeyCredential = new StorageSharedKeyCredential(AZURE_ACCOUNT_NAME, AZURE_ACCOUNT_KEY);
            const tokens = {};
            for (const user of users) {
                const { uid, blobPath } = user;
                if (!uid || !blobPath) continue;

                // ✅ blobPath에서 파일 이름만 추출
                console.log(`--- [다중 토큰 발급] UID: ${uid} ---`);
                console.log(`1. 원본 blobPath: ${blobPath}`);

                const url = new URL(blobPath);
                console.log('2. URL 객체: ', url);

                const fullPath = url.pathname.slice(1); // 'new/users/...'
                console.log(`3. 컨테이너 포함 경로 (fullPath): ${fullPath}`);

                const blobName = fullPath.split('/').slice(1).join('/'); // 'users/...'
                console.log(`4. 순수한 Blob 이름 (blobName): ${blobName}`);
                 if (!blobName) {
                console.warn(`UID ${uid}의 Blob 이름을 추출할 수 없습니다: ${blobPath}`);
                continue; // 다음 사용자로 건너뛰기
               }   

                const readSasOptions = {
                    containerName: AZURE_CONTAINER_NAME,
                    blobName: blobName,
                    permissions: BlobSASPermissions.from({ read: true }),
                    expiresOn: new Date(new Date().valueOf() + 60 * 60 * 1000)
                };
                const sasToken = generateBlobSASQueryParameters(readSasOptions, sharedKeyCredential).toString();
                tokens[uid] = sasToken;
            }
            console.log(`서버: 총 ${users.length}명의 사용자에 대한 SAS 토큰 발급 성공`);
            return res.status(200).json({
                success: true,
                message: 'SAS 토큰이 성공적으로 발급되었습니다.',
                tokens: tokens,
                expiry: new Date(new Date().valueOf() + 60 * 60 * 1000).toISOString()
            });
        } catch (error) {
            console.error("서버: 다중 SAS 토큰 발급 중 오류 발생:", error);
            return res.status(500).json({ success: false, message: '다중 SAS 토큰 발급 중 오류가 발생했습니다.' });
        }
    });

    // 5. 단일 SAS 토큰 발급 (수정됨)
    // 이 라우터는 이제 blobName이 아닌 blobPath를 받습니다.
    router.post('/get-sas-token', async (req, res) => {
        const { uid, blobPath } = req.body;
        if (!uid || !blobPath) {
            return res.status(400).json({ success: false, message: "User ID (uid) and blob path are required." });
        }
        try {
            // ✅ blobPath에서 파일 이름만 추출
            const blobName = new URL(blobPath).pathname.substring(1);
            const sasToken = await generateSasToken(blobName);
            res.json({
                success: true,
                message: "SAS token successfully generated.",
                token: `?${sasToken}`,
                expiry: new Date(new Date().valueOf() + (30 * 60 * 1000)).toISOString()
            });
        } catch (error) {
            console.error("Error generating SAS token:", error);
            res.status(500).json({ success: false, message: "Failed to generate SAS token." });
        }
    });
}

// ⭐ 이 부분이 있어야 server.js에서 이 라우터를 import 할 수 있습니다.
module.exports = router;