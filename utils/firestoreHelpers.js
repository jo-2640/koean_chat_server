// backend/utils/firestoreHelpers.js
const { admin } = require('../config/firebaseAdmin');

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
            const deleteResult = await admin.auth().deleteUsers(batchUids);
            if (deleteResult.errors && deleteResult.errors.length > 0) {
                console.error(`사용자 배치 삭제 오류:`, deleteResult.errors);
                throw new Error(`사용자 배치 삭제 중 ${deleteResult.errors.length}개의 오류 발생. 첫 번째 오류: ${deleteResult.errors[0].message}`);
            }
            console.log(`${batchUids.length}명의 사용자 배치 삭제 완료. ${deleteResult.successCount}명 성공적으로 처리됨.`);
            totalDeleted += deleteResult.successCount;
        }
        return totalDeleted;
    }
    return 0;
}

module.exports = {
    deleteCollection,
    deleteAllAuthUsers
};