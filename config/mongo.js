
// backend/config/env.js
if (process.env.NODE_ENV !== 'production') {
    const path = require('path');
    require('dotenv').config({ path: path.join(__dirname, '.env') }); 
}
const mongoose = require('mongoose');

const connectMongoDB = async () => {
  try {
    await mongoose.connect(process.env.DB_URL);
    console.log("✅ MongoDB 연결 성공");
  } catch (err) {
    console.error("❌ MongoDB 연결 실패", err);
    process.exit(1); // 연결 실패 시 서버 종료
  }
};

module.exports = connectMongoDB;
