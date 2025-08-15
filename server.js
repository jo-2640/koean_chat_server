// backend/server.js
// ----------------------------------------------------
// 1. 필요한 모듈 불러오기
// ----------------------------------------------------
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { getAuth } = require('firebase-admin/auth');

// 2. 환경 설정 및 서비스 초기화 모듈 로드
// 이 모듈들은 자체적으로 초기화 로직을 실행합니다.
// ⭐⭐⭐ 이 라인을 다시 추가했습니다. ⭐⭐⭐
require('./config/env'); 
require('./config/firebaseAdmin');
require('./config/azureStorage');

// 3. API 라우트 모듈 불러오기
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const storageRoutes = require('./routes/storageRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userInfoRoutes = require('./routes/userInfoRoutes');

const app = express();
const port = process.env.PORT || 3000;

// 4. 공통 미들웨어 설정
const clientOrigin = process.env.CLIENT_BASE_URL || 'http://localhost:5173';
console.log(`클라이언트 오리진: ${clientOrigin}`); // 클라이언트 오리진을 로그로 출력합니다.
const corsOptions = {
    origin: clientOrigin,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    credentials: true,
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.use(express.json());

// 5. API 라우트 연결
app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', storageRoutes);
app.use('/api', adminRoutes);
app.use('/api', userInfoRoutes);

// ----------------------------------------------------
// 6. Socket.IO 설정 및 이벤트 핸들러
// ----------------------------------------------------
const server = http.createServer(app);
const userIdToSocketId = new Map();

const io = new Server(server, {
    cors: {
        // ⭐⭐⭐ Express CORS 설정과 일치시켰습니다. ⭐⭐⭐
        origin: clientOrigin,
    }
});

// ⭐⭐ 인증 미들웨어: 모든 소켓 연결 시 토큰을 검증합니다.
io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;

    // ⭐ 소켓 연결 요청이 도착했는지 확인하는 로그
    console.log('[Socket Auth] 소켓 연결 요청 수신'); 

    if (!token) {
        console.error('[Socket Auth] 인증 토큰이 없습니다. 연결 거부.');
        return next(new Error('인증 토큰이 없습니다.'));
    }

    try {
        console.log('[Socket Auth] 토큰 검증 시작:', token.substring(0, 30) + '...');
        const decodedToken = await getAuth().verifyIdToken(token);
        
        // ⭐ 토큰 검증에 성공했을 때만 이 로그가 출력됩니다.
        console.log(`[Socket Auth] 토큰 검증 성공. 유저: ${decodedToken.email}`);
        
        socket.user = {
            userId: decodedToken.uid,
            username: decodedToken.name || decodedToken.email,
            email: decodedToken.email
        };
        next();
    } catch (error) {
        // ⭐ 토큰 검증에 실패했을 때 어떤 에러가 발생했는지 확인합니다.
        console.error('[Socket Auth] 토큰 검증 실패:', error.message);
        next(new Error('유효하지 않은 토큰입니다.'));
    }
});

// ⭐⭐ 주요 소켓 이벤트 핸들러: 인증된 사용자만 처리합니다.
io.on('connection', (socket) => {
    const userId = socket.user.userId;
    userIdToSocketId.set(userId, socket.id);
    console.log(`${socket.user.username} (ID: ${userId}) 님이 접속했습니다.`);

    socket.on('disconnect', () => {
        userIdToSocketId.delete(userId);
        console.log(`${socket.user.username} 님이 접속을 종료했습니다.`);
    });
    
    socket.on('join room', (roomId) => {
        socket.join(roomId);
        console.log(`${socket.user.username}가 ${roomId} 방에 참여했습니다.`);
    });

    socket.on('chat message', (data) => {
        const senderId = socket.user.userId;
        const senderUsername = socket.user.username;
        const roomId = data.roomId;
        
        // 서버에서 메시지 Payload를 생성합니다.
        const messagePayload = {
            message: data.message,
            roomId: roomId,
            senderId: senderId,
            senderName: senderUsername,
        };

        // 1. 메시지를 방 전체에 브로드캐스트 (나와 친구 모두에게 보임)
        io.to(roomId).emit('chat message', messagePayload);
        
        // 2. 상대방이 온라인이지만, 현재 채팅방에 있는지 확인
        const [user1Id, user2Id] = roomId.split('_').sort();
        const recipientId = (user1Id === senderId) ? user2Id : user1Id;
        const recipientSocket = io.sockets.sockets.get(userIdToSocketId.get(recipientId));
        
        // 3. 상대방이 방에 없으면, 알림만 보냅니다.
        if (recipientSocket && !recipientSocket.rooms.has(roomId)) {
            console.log(`[알림 전송] ${senderUsername} -> ${recipientId}: 방에 없는 상대방에게 알림 전송`);
            io.to(recipientSocket.id).emit('notify message', {
                roomId: roomId,
                senderId: senderId,
                senderName: senderUsername,
                message: data.message
            });
        }
        
        // 4. 상대방이 오프라인이면 메시지를 전달할 수 없음을 알립니다.
        if (!recipientSocket) {
            console.log(`[오프라인] ${senderUsername} -> ${recipientId}: 메시지를 전달할 수 없습니다.`);
        }
    });
});

// ----------------------------------------------------
// 7. 서버 시작
// ----------------------------------------------------
server.listen(port, () => {
    serverbaseurl = process.env.SERVER_BASE_URL;
    console.log(`서버가 ${serverbaseurl}에서 실행 중입니다.`); 
    console.log(`애플리케이션이 성공적으로 초기화되었습니다.`);
});