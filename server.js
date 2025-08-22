// backend/server.js

//SERVER_BASE_URL_https://koean-chat-server.onrender.com
// ----------------------------------------------------
// 1. 필요한 모듈 불러오기
// ----------------------------------------------------
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { getAuth } = require('firebase-admin/auth');
const connectMongoDB = require('./config/mongo'); // MongoDB 모듈 불러오기
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
const configureSocketHandlers = require('./socket/socket_handler');
const chatRoutes = require('./routes/chatRoutes');
const app = express();
const port = process.env.PORT || 3000;

// 4. 공통 미들웨어 설정
const clientOrigin = process.env.CLIENT_BASE_URL || 'http://localhost:5173';
console.log(`클라이언트 오리진: ${clientOrigin}`); // 클라이언트 오리진을 로그로 출력합니다.
const corsOptions = {
    origin: '*',
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
app.use('/api', chatRoutes);
app.get('/ping', (req, res) => {
    // 200 OK 상태 코드와 함께 간단한 텍스트 응답을 보냅니다.
    // Send a simple text response with a 200 OK status code.
    console.log('핑 요청을 받았습니다. OK 응답을 보냅니다.');
    res.status(200).send('OK');
});
// ----------------------------------------------------
// 6. Socket.IO 설정 및 이벤트 핸들러
// ----------------------------------------------------
const server = http.createServer(app);
const userIdToSocketId = new Map();

const io = new Server(server, {
    cors: {
        // ⭐⭐⭐ Express CORS 설정과 일치시켰습니다. ⭐⭐⭐
        origin: '*',
    }
});
// ✅ configureSocketHandlers 함수를 호출하여 소켓 이벤트 설정
configureSocketHandlers(io);
// MongoDB 연결
connectMongoDB();


// ----------------------------------------------------
// 7. 서버 시작
// ----------------------------------------------------
server.listen(port, () => {
    serverbaseurl = process.env.SERVER_BASE_URL;
    console.log(`서버가 ${serverbaseurl}에서 실행 중입니다.`); 
    console.log(`애플리케이션이 성공적으로 초기화되었습니다.`);
});