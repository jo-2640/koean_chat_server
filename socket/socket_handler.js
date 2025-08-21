// backend/socket_handler.js

const { getAuth } = require('firebase-admin/auth');

// 사용자 ID와 소켓 ID를 매핑하는 맵
const userIdToSocketId = new Map();

// 모든 소켓 이벤트 핸들러를 관리하는 함수
const configureSocketHandlers = (io) => {

    // ✅ 소켓 인증 미들웨어: 모든 연결 시 토큰을 검증합니다.
    io.use(async (socket, next) => {
        const token = socket.handshake.auth.token;

        if (!token) {
            console.error('[Socket Auth] 인증 토큰이 없습니다. 연결 거부.');
            return next(new Error('인증 토큰이 없습니다.'));
        }

        try {
            const decodedToken = await getAuth().verifyIdToken(token);
            socket.user = { userId: decodedToken.uid, username: decodedToken.name || decodedToken.email };
            next();
        } catch (error) {
            console.error('[Socket Auth] 토큰 검증 실패:', error.message);
            next(new Error('유효하지 않은 토큰입니다.'));
        }
    });

    // ✅ 주요 소켓 이벤트 핸들러: 인증된 사용자만 처리합니다.
    io.on('connection', (socket) => {
        const userId = socket.user.userId;
        userIdToSocketId.set(userId, socket.id);
        console.log(`[Socket] ${socket.user.username} (ID: ${userId}) 님이 접속했습니다.`);

        // ❌ 에러 처리 추가: 잘못된 이벤트 수신
        socket.on('error', (error) => {
            console.error(`[Socket Error] ${socket.user.username}의 소켓 오류:`, error);
        });

        // ----------------------------------------------------
        // ✅ 소켓 이벤트: joinRoom, chat message 등
        // ----------------------------------------------------
        socket.on('joinRoom', (data) => {
            // 🚨 에러 처리: roomId가 누락된 경우
            if (!data.roomId) {
                console.error(`[오류] 잘못된 'joinRoom' 요청: roomId가 누락되었습니다.`, data);
                socket.emit('error', { message: `'joinRoom' 요청에 roomId가 누락되었습니다.` });
                return;
            }
            socket.join(data.roomId);
            console.log(`[Socket] ${socket.user.username}가 방 ${data.roomId}에 참여했습니다.`);
        });

        socket.on('chat message', (data) => {
            // 🚨 에러 처리: 필수 필드 누락
            // 🚨 에러 처리: 필수 필드 누락
            if (!data.roomId || !data.message || !data.senderId) {
                console.error(`[오류] 잘못된 'chat message' 데이터: 필수 필드 누락`, data);
                socket.emit('error', { message: '잘못된 형식의 메시지입니다.' });
                return;
            }

            // ⭐⭐ 서버 로그 추가 (1): 메시지 수신 확인 ⭐⭐
            console.log(`[서버] 'chat message' 이벤트 수신: ${JSON.stringify(data)}`);

            // ⭐⭐ 서버 로그 추가 (2): 방의 소켓 수 확인 ⭐⭐
            const room = io.sockets.adapter.rooms.get(data.roomId);
            const numSocketsInRoom = room ? room.size : 0;
            console.log(`[서버] 방 ${data.roomId}에 현재 ${numSocketsInRoom}개의 소켓이 있습니다.`);

            // 메시지를 방 전체에 브로드캐스트
            io.to(data.roomId).emit('chat message', data);

            // ⭐⭐ 서버 로그 추가 (3): 브로드캐스트 완료 확인 ⭐⭐
            console.log(`[서버] 메시지를 방 ${data.roomId}에 브로드캐스트했습니다.`);

            // ⭐ 서버 에러 로그: 상대방이 방에 없을 때
            const recipientId = getRecipientId(data.roomId, data.senderId);
            const recipientSocket = io.sockets.sockets.get(userIdToSocketId.get(recipientId));
            if (recipientSocket && !recipientSocket.rooms.has(data.roomId)) {
                console.log(`[알림 전송] ${socket.user.username} -> ${recipientId}: 방에 없는 상대방에게 알림 전송`);
            }
        });

        socket.on('disconnect', () => {
            userIdToSocketId.delete(userId);
            console.log(`[Socket] ${socket.user.username} 님이 접속을 종료했습니다.`);
        });
    });
};

// 헬퍼 함수
const getRecipientId = (roomId, senderId) => {
    const [user1Id, user2Id] = roomId.split('_').sort();
    return (user1Id === senderId) ? user2Id : user1Id;
};

// 모듈로 내보내기
module.exports = configureSocketHandlers;