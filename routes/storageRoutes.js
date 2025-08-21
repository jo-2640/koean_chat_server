// backend/routes/storageRoutes.js
const express = require('express');
const router = express.Router();
const {
    sharedKeyCredential,
    generateBlobSASQueryParameters,
    BlobSASPermissions,
    AZURE_CONTAINER_NAME,
    AZURE_STORAGE_ACCOUNT_NAME
} = require('../config/azureStorage');
const { db } = require('../config/firebaseAdmin');
const { getDefaultProfileImageUrl } = require('../config/defaultImages');

/*router.post('/getBlobSasToken', async (req, res) => {
    console.log("SAS 토큰 생성 요청 받음, 요청 본문:", req.body);
    try {
        const { filename, contentType } = req.body;

        console.log(`서버: SAS 토큰 요청을 위한 클라이언트 filename: ${filename}, Content-Type: ${contentType}`);
        if (!filename || !contentType) {
            return res.status(400).json({ success: false, message: '파일 이름과 콘텐츠 타입은 필수입니다.' });
        }

        const sasOptions = {
            containerName: AZURE_CONTAINER_NAME,
            blobName: filename,
            permissions: BlobSASPermissions.from({ write: true, create: true, read: true, add: true }),
            startsOn: new Date(new Date().valueOf() - (10 * 1000)),
            expiresOn: new Date(new Date().valueOf() + (5 * 60 * 1000)),
        };
        console.log(`서버: SAS 토큰 생성에 사용될 blobName: ${sasOptions.blobName}`);
        const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();
        console.log(`SAS 토큰 생성 성공 - 파일명: ${filename}, 토큰: ${sasToken.substring(0, 30)}...`);

        const blobUrl = `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${AZURE_CONTAINER_NAME}/${filename}`;

        res.status(200).json({
            success: true,
            storageAccountUrl: `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
            containerName: AZURE_CONTAINER_NAME,
            sasToken: sasToken,
            blobUrl: blobUrl
        });
    } catch (error) {
        console.error('SAS 토큰 생성 오류:', error);
        res.status(500).json({ success: false, message: 'SAS 토큰 생성에 실패했습니다.', error: error.message });
    }
});*/

router.post('/getProfileImageUrl', async (req, res) => {
    console.log("백엔드: 프로필 이미지 url 요청받음, 요청 본문:", req.body);
    const { userId, requestorUid } = req.body;

    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 500;

    try {
        if (!userId || !requestorUid) {
            return res.status(400).json({ success: false, message: '사용자 ID와 요청자 UID는 필수입니다.' });
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
                console.log(`백엔드: Firestore에서 가져온 profileImgUrl: ${userData.profileImgUrl}`);
                break;
            } else {
                console.warn(`백엔드: ${userId}에 대한 사용자 문서 시도 ${i + 1}에서 찾을 수 없음. ${RETRY_DELAY_MS}ms 후에 재시도합니다...`);
                if (i < MAX_RETRIES - 1) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                }
            }
        }

        if (!userDoc || !userDoc.exists) {
            console.warn(`백엔드: ${MAX_RETRIES}번 재시도 후에도 ${userId}에 대한 사용자 문서를 찾을 수 없음. 기본 이미지 반환.`);
            return res.status(200).json({ success: true, imageUrl: getDefaultProfileImageUrl(null) });
        }

        const userData = userDoc.data();
        const storedProfileImgUrl = userData.profileImgUrl;

        if (!storedProfileImgUrl || !storedProfileImgUrl.includes(AZURE_STORAGE_ACCOUNT_NAME)) {
            console.log(`백엔드: ${userId}의 비-Azure 또는 기본 프로필 이미지: ${storedProfileImgUrl}. 있는 그대로 반환합니다.`);
            return res.status(200).json({ success: true, imageUrl: storedProfileImgUrl || getDefaultProfileImageUrl(userData.gender) });
        }

        const urlParts = storedProfileImgUrl.split('/');
        const containerIndex = urlParts.indexOf(AZURE_CONTAINER_NAME);
        if (containerIndex === -1) {
            console.warn(`백엔드: 저장된 URL에서 컨테이너 이름 '${AZURE_CONTAINER_NAME}'을 찾을 수 없음: ${storedProfileImgUrl}. 기본 이미지 반환.`);
            return res.status(200).json({ success: true, imageUrl: getDefaultProfileImageUrl(userData.gender) });
        }
        const blobName = urlParts.slice(containerIndex + 1).join('/');

        let finalImageUrl;
        let hasAccess = false;

        if (userId === requestorUid) {
            hasAccess = true;
            console.log(`백엔드: 접근 허용: ${userId}는 본인입니다.`);
        } else {
            const requestorDoc = await db.collection('users').doc(requestorUid).get();
            const requestorData = requestorDoc.data();
            if (requestorData && requestorData.friendIds && requestorData.friendIds.includes(userId)) {
                hasAccess = true;
                console.log(`백엔드: 접근 허용: ${userId}는 ${requestorUid}의 친구입니다.`);
            } else {
                console.log(`백엔드: 접근 거부: ${userId}는 본인이 아니거나 ${requestorUid}의 친구가 아닙니다.`);
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
            console.log(`백엔드: ${userId}에 대해 SAS URL 생성됨: ${finalImageUrl.substring(0, 100)}...`);
        } else {
            finalImageUrl = getDefaultProfileImageUrl(userData.gender);
            console.log(`백엔드: 접근 권한 없음으로 인해 ${userId}에 대해 기본 이미지 반환.`);
        }
        res.status(200).json({ success: true, imageUrl: finalImageUrl });
    } catch (error) {
        console.error('백엔드: 프로필 이미지 URL 가져오기 오류:', error);
        res.status(500).json({ success: false, message: '프로필 이미지 URL을 가져오지 못했습니다.', error: error.message });
    }
});

module.exports = router;