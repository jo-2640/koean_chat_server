// backend/middleware/appIoMiddleware.js
const { users } = require('./socketAuth');

module.exports = (app, io) => {
    app.set('io', io);       // ✅ req가 아니라 app에 직접 set
    app.set('users', {}); // ✅ 마찬가지
    console.log('💡 app에 io와 users 등록 완료');
};
