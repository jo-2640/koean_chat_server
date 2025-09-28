// backend/server.js

// 1. 필요한 모듈 불러오기
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { getAuth } = require('firebase-admin/auth');
const connectMongoDB = require('./config/mongo');

// 2. 환경 설정 및 서비스 초기화 모듈 로드
require('./config/env');
require('./config/firebaseAdmin');
require('./config/azureStorage');

// 3. API 라우트 모듈 불러오기
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const storageRoutes = require('./routes/storageRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userInfoRoutes = require('./routes/userInfoRoutes');
const { socketAuthMiddleware, users } = require('./middleware/socketAuth');
const { configureSocketHandlers } = require('./socket/socket_handler');
const configureAppIo = require('./middleware/appIoMiddleware');
const chatRoutes = require('./routes/chatRoutes'); // 💚 chatRoutes 추가
const mongoUserRoutes = require('./routes/mongoUserRoutes'); //친구,알림, 채팅
const mongoAuthRoutes = require('./routes/mongoAuthRoutes'); //몽고 회원가입,회원정보
const mongoFriendRoutes = require('./routes/mongoFriendRoutes') //전체 유저 정보나 개인 유저 정보가져오기
const app = express();
const port = process.env.PORT || 3000;

// 4. 공통 미들웨어 설정
const clientOrigin = process.env.CLIENT_BASE_URL || 'http://localhost:5173';
console.log(`클라이언트 오리진: ${clientOrigin}`);
const corsOptions = {
    origin: '*',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    credentials: true,
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.use(express.json());

// ----------------------------------------------------
// ✅ 5. 소켓 서버 인스턴스 생성 및 Express 앱 연결 (위로 이동)
// ⭐️ 이 부분이 모든 API 라우터 연결보다 위에 있어야 합니다.
// ----------------------------------------------------
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'https://chat-html-theta.vercel.app/',
    }
});

// ✅ 여기서 app에 io 인스턴스를 연결<<><
configureAppIo(app, io);
io.use(socketAuthMiddleware);
configureSocketHandlers(io, app);
// ----------------------------------------------------
// ✅ 6. API 라우트 연결
// ----------------------------------------------------
app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', storageRoutes);
app.use('/api', adminRoutes);
app.use('/api', userInfoRoutes);
app.use('/api', mongoUserRoutes);
app.use('/api', mongoAuthRoutes);
app.use('/api', chatRoutes);
app.use('/api', mongoFriendRoutes);
app.post('/ping', (req, res) => {
    console.log('핑 요청을 받았습니다. OK 응답을 보냅니다.');
    res.status(200).json({
        echo: req.body
    });
});

// ----------------------------------------------------
// ✅ 7. Socket.IO 설정 및 이벤트 핸들러
// ----------------------------------------------------


// MongoDB 연결
connectMongoDB();

// ----------------------------------------------------
// 8. 서버 시작
// ----------------------------------------------------
server.listen(port, () => {
    const serverbaseurl = process.env.SERVER_BASE_URL;
    console.log(`서버가 ${serverbaseurl}에서 실행 중입니다.`);
    console.log(`애플리케이션이 성공적으로 초기화되었습니다.`);
});