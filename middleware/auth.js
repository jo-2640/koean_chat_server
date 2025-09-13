// backend/middleware/auth.js

const { getAuth } = require('firebase-admin/auth');

const isAuthenticated = async (req, res, next) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];

    if (!idToken) {
        return res.status(401).json({ message: '인증 토큰이 누락되었습니다.' });
    }

    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        req.user = decodedToken;
        console.log('💡 토큰 미들웨어 인증 성공, uid:', decodedToken.uid);
        next();
    } catch (error) {
        console.error('토큰 검증 오류:', error);
        return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
    }
};

module.exports = { isAuthenticated };