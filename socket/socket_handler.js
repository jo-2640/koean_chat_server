// backend/socket_handler.js

const { getAuth } = require('firebase-admin/auth');

// 사용자 ID와 소켓 ID를 매핑하는 맵
const userIdToSocketId = new Map();

// 모든 소켓 이벤트 핸들러를 관리하는 함수
const configureSocketHandlers = (io, app) => {

    // ✅ 주요 소켓 이벤트 핸들러: 인증된 사용자만 처리합니다.
    io.on('connection', (socket) => {
        // ⭐ 핵심 수정 (1): socket.user가 존재하는지 먼저 확인
        if (!socket.user) {
            console.error("[오류] 인증되지 않은 소켓이 연결을 시도했습니다. 연결을 종료합니다.");
            socket.disconnect(true);
            return;
        }
        const userId = socket.user.uid; // 먼저 선언
        userIdToSocketId.set(userId, socket.id);
        // 앱 전역에도 등록
        app.set('users', Object.fromEntries(userIdToSocketId));
        console.log(`[Socket] ${socket.user?.email} (ID: ${socket.user?.uid}) 접속 시도`);
        console.log('현재 userIdToSocketId 맵:');
        console.log(userIdToSocketId);
        console.log(`[Socket] ${socket.user.email} (ID: ${userId}) 님이 접속했습니다. 소켓 ID: ${socket.id}`);

        // 전체 맵 확인
        console.log('현재 userIdToSocketId 맵:');
        for (const [k, v] of userIdToSocketId.entries()) {
            console.log('userId:', k, 'socketId:', v);
        }

        // ❌ 에러 처리 추가: 잘못된 이벤트 수신
        socket.on('error', (error) => {
            console.error(`[Socket Error] ${userId}의 소켓 오류:`, error);
        });

        // ----------------------------------------------------
        // ✅ 소켓 이벤트: joinRoom, chat message 등
        // ----------------------------------------------------
        socket.on('joinRoom', (data, ack) => {
            if (!data.roomId) {
                console.error(`[오류] 잘못된 'joinRoom' 요청: roomId가 누락되었습니다.`, data);
                if (ack) ack({ status: 'error', message: 'roomId missing' });
                return;
            }
            socket.join(data.roomId);
            console.log(`[Socket] ${socket.user.uid}가 방 ${data.roomId}에 참여했습니다.`);
            if (ack) {
                ack({ status: 'ok', messageId: data.messageId });
                console.log(`[서버] 클라이언트에게 ACK 전송: ID ${data.messageId}`);
            }
        });

       // D:\volcano_chat\backend\socket\socket_handler.js

// ✅ `socket.on('chat message', (data, callback) => { ... })`
//    와 같이 클라이언트가 보낸 데이터가 `data` 인자로 전달됩니다.
        socket.on('chat message', (data, callback) => {
        try {
            const { roomId, message, senderId, messageId } = data;

            // 1. 필수 데이터 유효성 검사
            if (!roomId || !message || !senderId || !messageId) {
                console.warn(`⚠️ [서버] 유효하지 않은 메시지 데이터 수신: ${JSON.stringify(data)}`);
            // 유효성 검사를 더 구체적으로 작성
                if (!roomId) {
                return callback({ status: 'error', message: 'Missing chatRoomId' });
            }
                if (!message) {
                return callback({ status: 'error', message: 'Missing text' });
            }
               if (!senderId) {
               return callback({ status: 'error', message: 'Missing senderId' });
            }
               if (!messageId) {
               return callback({ status: 'error', message: 'Missing messageId' });
            }
                if (typeof callback === 'function') {
                callback({ status: 'error', message: 'Invalid message data.' });
            }
                return;
            }

            console.log(`➡️ [서버] 메시지 수신 (ID: ${messageId})`);

            // 2. 메시지 브로드캐스트
            io.to(roomId).emit('chat message', {
            messageId,
            message,
            senderId,
            });
            console.log(`✅ [서버] 방 ${roomId}에 메시지 브로드캐스트. ID: ${messageId}`);

            // 3. 클라이언트에 ACK 전송
            if (typeof callback === 'function') {
            callback({ status: 'ok', message: '메시지가 성공적으로 처리되었습니다.' });
            }
        } catch (error) {
            console.error('💔 [서버] 채팅 메시지 처리 중 오류 발생:', error);
            if (typeof callback === 'function') {
            callback({ status: 'error', message: 'Server error occurred.' });
            }
        }
        });

        socket.on('disconnect', () => {
            // ⭐ 핵심 수정 (4): socket.user가 존재할 때만 userIdToSocketId에서 삭제하고 로그 출력
            if (socket.user) {
                userIdToSocketId.delete(userId);
                app.set('users', Object.fromEntries(userIdToSocketId));
                console.log(`[Socket] ${socket.user.email} (ID: ${socket.user.uid}) 님이 접속을 종료했습니다.`);
            } else {
                console.log(`[Socket] 인증되지 않은 사용자가 접속을 종료했습니다.`);
            }
            console.log(`[Socket] ${socket.user?.email || '알 수 없음'} 접속 종료`);
            console.log('현재 userIdToSocketId 맵:');
            console.log(userIdToSocketId);
        });
    });
};

// 헬퍼 함수
const getRecipientId = (roomId, senderId) => {
    const [user1Id, user2Id] = roomId.split('_').sort();
    return (user1Id === senderId) ? user2Id : user1Id;
};

// 모듈로 내보내기
module.exports = { configureSocketHandlers, userIdToSocketId };