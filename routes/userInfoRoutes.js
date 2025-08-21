// backend/routes/userInfoRoutes.js

const { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob');
const { AZURE_CONTAINER_NAME, AZURE_STORAGE_ACCOUNT_KEY, AZURE_STORAGE_ACCOUNT_NAME } = require('../config/env');
const {db} = require('../config/firebaseAdmin');
const express = require('express');
const router = express.Router();

router.post('/getProfileImgUrlWithSas' , async (req, res) =>{
    console.log("백엔드: 프로필 이미지 url 요청받음 Sas토큰발행, 요청 본문:", req.body);
    
    const{uid, profileImgUrl } = req.body;
    if(!uid) {
        return res.status(400).json({ success: false, message:'uid가 필요합니다.'});
    }

    try{
        const userData = await getUserDocumentWithRetry(uid);
        
        if (!userData) {
            console.log(`모든 재시도 후에도 사용자 문서를 찾을 수 없음: ${uid}`);
            return res.status(404).json({ 
                success: false, 
                message: '사용자 정보를 찾을 수 없습니다.' 
            });
        }

        const profileImgUrl = userData.profileImgUrl;

        if (!profileImgUrl) {
            return res.status(400).json({ 
                success: false, 
                message: '프로필 이미지 URL이 존재하지 않습니다' 
            });
        }
        const sharedKeyCredential = new StorageSharedKeyCredential(AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY);
        const blobServiceClient = new BlobServiceClient(`https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`, sharedKeyCredential); 
        const containerClient = blobServiceClient.getContainerClient(AZURE_CONTAINER_NAME)

        const url = new URL(profileImgUrl);
        const blobNameWithContainer = url.pathname.slice(1);
        const blobName = blobNameWithContainer.split('/').slice(1).join('/'); // 컨테이너 이름을 제외한 blob 이름

        if(!blobName){
            return res.status(400).json({ success: false, message: '유효한 blob 경로를 추출할 수없습니다.'});
        }
        const readSasOptions ={
            containerName: AZURE_CONTAINER_NAME,
            blobName: blobName,
            permissions: BlobSASPermissions.from({ read: true}),
            expiresOn: new Date(new Date().valueOf() +300 * 1000),
        };
        console.log(`서버: UID${uid}에 대한 SAS 토큰 발급 요청 - Blob 이름: ${readSasOptions.blobName}`);

        const readSasToken = generateBlobSASQueryParameters(readSasOptions, sharedKeyCredential).toString();
        const blobUrl = containerClient.getBlobClient(blobName).url;

        console.log(`서버: UID ${uid}에 대한 SAS 토큰 발급 성공`);
        return res.status(200).json({
            success: true,
            message: 'SAS 토큰이 성공적으로 발급되었습니다.',
            readSasToken: readSasToken,
            blobUrl: blobUrl
        });
    } catch (error) {
        console.error("서버: SAS 토큰 발급 중 오류 발생:", error);
        return res.status(500).json({ success: false, message: 'SAS 토큰 발급 중 오류가 발생했습니다.' });
    }
});
router.post('/getProfileImgUrlWithSasVer2', async (req, res) => {
    console.log("백엔드: 프로필 이미지 url 요청받음 Sas토큰발행, 요청 본문:", req.body);
    
    const { uid } = req.body; // 🔥 uid만 받음
    
    if (!uid) {
        return res.status(400).json({ success: false, message: 'UID가 필요합니다.' });
    }

    try {
        // 🔥 Firestore에서 사용자 문서 조회
        const userDoc = await db.collection('users').doc(uid).get();
        
        if (!userDoc.exists) {
            console.log(`사용자 문서가 아직 생성되지 않음: ${uid}`);
            return res.status(400).json({ 
                success: false, 
                message: '사용자 정보를 찾을 수 없습니다. 잠시 후 다시 시도해주세요.' 
            });
        }

        const userData = userDoc.data();
        const profileImgUrl = userData.profileImgUrl;

        if (!profileImgUrl) {
            return res.status(400).json({ 
                success: false, 
                message: '프로필 이미지 URL이 존재하지 않습니다' 
            });
        }

        // 기존 SAS 토큰 생성 로직
        const sharedKeyCredential = new StorageSharedKeyCredential(AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY);
        const blobServiceClient = new BlobServiceClient(`https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`, sharedKeyCredential); 
        const containerClient = blobServiceClient.getContainerClient(AZURE_CONTAINER_NAME);

        const url = new URL(profileImgUrl);
        const blobNameWithContainer = url.pathname.slice(1);
        const blobName = blobNameWithContainer.split('/').slice(1).join('/');

        if (!blobName) {
            return res.status(400).json({ success: false, message: '유효한 blob 경로를 추출할 수없습니다.' });
        }

        const readSasOptions = {
            containerName: AZURE_CONTAINER_NAME,
            blobName: blobName,
            permissions: BlobSASPermissions.from({ read: true }),
            expiresOn: new Date(new Date().valueOf() + 300 * 1000),
        };

        console.log(`서버: UID ${uid}에 대한 SAS 토큰 발급 요청 - Blob 이름: ${readSasOptions.blobName}`);

        const readSasToken = generateBlobSASQueryParameters(readSasOptions, sharedKeyCredential).toString();
        const blobUrl = containerClient.getBlobClient(blobName).url;

        console.log(`서버: UID ${uid}에 대한 SAS 토큰 발급 성공`);
        return res.status(200).json({
            success: true,
            message: 'SAS 토큰이 성공적으로 발급되었습니다.',
            readSasToken: readSasToken,
            blobUrl: blobUrl,
            profileImageUrl: `${blobUrl}?${readSasToken}` // 🔥 완전한 URL도 함께 반환
        });

    } catch (error) {
        console.error("서버: SAS 토큰 발급 중 오류 발생:", error);
        return res.status(500).json({ success: false, message: 'SAS 토큰 발급 중 오류가 발생했습니다.' });
    }
});

async function getUserDocumentWithRetry(uid, maxRetries = 5, retryDelay = 200) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`사용자 문서 조회 시도 ${attempt}/${maxRetries} - UID: ${uid}`);
            
            const userDoc = await db.collection('users').doc(uid).get();
            
            if (userDoc.exists) {
                console.log(`사용자 문서 조회 성공 - UID: ${uid}`);
                return userDoc.data();
            }
            
            console.log(`사용자 문서가 아직 생성되지 않음 - 시도 ${attempt}/${maxRetries}`);
            
            // 마지막 시도가 아니면 대기
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
            
        } catch (error) {
            console.error(`사용자 문서 조회 중 오류 - 시도 ${attempt}/${maxRetries}:`, error);
            
            // 마지막 시도가 아니면 대기
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            } else {
                throw error; // 마지막 시도에서도 실패하면 오류 던지기
            }
        }
    }
    
    return null; // 모든 시도 후에도 문서를 찾지 못함
}
module.exports = router;