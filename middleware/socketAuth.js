// backend/middleware/socketAuth.js

const admin = require('firebase-admin');

// 💡 Firebase Admin SDK는 메인 서버 파일에서 이미 초기화되었다고 가정합니다.
const users = {}; 

const socketAuthMiddleware = async (socket, next) => {
    // 클라이언트가 보낸 토큰을 확인합니다.
    const idToken = socket.handshake.auth.token;

    // ✅ 로그에 토큰의 앞 5글자만 표시하여 개인정보를 보호합니다.
    const tokenDisplay = idToken ? idToken.substring(0, 5) + '...' : '없음';
    console.log(`클라이언트가 보낸 인증 데이터: { token: '${tokenDisplay}' }`);

    if (!idToken) {
        // 토큰이 없으면 즉시 연결을 거부하고 오류를 반환합니다.
        console.error("💔 소켓 인증 실패: 토큰이 제공되지 않았습니다.");
        return next(new Error("인증 오류: 토큰이 없습니다."));
    }

    try {
        // Firebase Admin SDK를 사용하여 토큰을 검증합니다.
        const decodedToken = await admin.auth().verifyIdToken(idToken);

        // 인증에 성공하면 사용자 정보를 소켓 객체에 추가합니다.
        socket.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
        };

        // 다음 미들웨어 또는 'connection' 이벤트 핸들러로 넘어갑니다.
        console.log(`🟢 소켓 인증 성공: 사용자 ${socket.user.uid} 토큰 검증 완료.`);
        next();
    } catch (error) {
        // 토큰 검증 실패 시 오류를 로깅하고 연결을 거부합니다.
        console.error("💔 소켓 인증 실패:", error.message);
        return next(new Error("인증 오류: 유효하지 않은 토큰입니다."));
    }
};


// 💡 모듈 내보내기 코드를 한 번만 작성합니다.
module.exports = { socketAuthMiddleware , users};