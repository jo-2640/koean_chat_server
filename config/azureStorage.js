// backend/config/azureStorage.js
const { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob');
const { AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY, AZURE_CONTAINER_NAME } = require('./env');

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
        console.log(`Azure Blob 컨테이너 '${AZURE_CONTAINER_NAME}' 준비 완료.`);
    } catch (error) {
        console.error("오류: Azure Blob 컨테이너 생성 또는 확인 실패:", error);
        process.exit(1); // 컨테이너가 준비되지 않으면 종료
    }
}

// 앱 시작 시 한 번 호출
ensureContainerExists();

module.exports = {
    blobServiceClient,
    containerClient,
    sharedKeyCredential,
    generateBlobSASQueryParameters,
    BlobSASPermissions,
    AZURE_CONTAINER_NAME,
    AZURE_STORAGE_ACCOUNT_NAME
};