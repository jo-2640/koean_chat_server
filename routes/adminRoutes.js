// backend/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { deleteCollection, deleteAllAuthUsers } = require('../utils/firestoreHelpers');

router.post('/delete-all-data', async (req, res) => {
    try {
        console.log('API 호출 수신: /delete-all-data');

        console.log('모든 인증 사용자 삭제 중...');
        const authUsersDeleted = await deleteAllAuthUsers();
        console.log(`${authUsersDeleted}명의 인증 사용자가 삭제되었습니다.`);

        console.log('모든 Firestore 컬렉션 삭제 중...');
        const collectionsToDelete = ['users', 'userProfiles', 'conversations'];

        for (const collectionName of collectionsToDelete) {
            console.log(`컬렉션 삭제: ${collectionName}`);
            await deleteCollection(collectionName);
            console.log(`컬렉션 ${collectionName} 삭제 완료.`);
        }

        res.status(200).json({ success: true, message: `총 ${authUsersDeleted}명의 사용자와 지정된 모든 Firestore 컬렉션이 삭제되었습니다.` });

    } catch (error) {
        console.error("API에서 모든 사용자 데이터 삭제 중 오류 발생:", error);
        res.status(500).json({ success: false, message: `데이터 삭제 중 오류 발생: ${error.message}` });
    }
});

module.exports = router;