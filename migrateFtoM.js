
 // migrateFirebaseToMongo.js

const mongoose = require('mongoose');
const admin = require('firebase-admin');
const User = require('./models/User'); // 이전에 작성한 User 모델

// 🔹 1. Firebase Admin 초기화
const serviceAccount = require('./config/FIREBASE_ADMIN_CREDENTIALS.json'); // Firebase 서비스 계정 키

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firestore = admin.firestore();

// 🔹 2. MongoDB 연결
async function connectMongo() {
  try {
    await mongoose.connect(
      'mongodb+srv://joengin3343:IG2NWd3tor9lj8TD@jojoengin.ngn9vw9.mongodb.net/chatapp', 
      { useNewUrlParser: true, useUnifiedTopology: true }
    );
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
}

// 🔹 3. Firebase 유저 가져오기
async function getFirebaseUsers() {
  const snapshot = await firestore.collection('users').get();
  const users = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    users.push({
      uid: doc.id, // Firebase UID
      nickname: data.nickname,
      email: data.email,
      profileImgUrl: data.profileImgUrl || null,
      statusMessage: data.statusMessage || null,
      isOnline: data.isOnline || false,
      lastActive: data.lastActive ? data.lastActive.toDate() : new Date(),
      birthYear: data.birthYear || null,
      bio: data.bio || '',
      gender: data.gender || null,
      region: data.region || null,
      minAgeGroup: data.minAgeGroup || null,
      maxAgeGroup: data.maxAgeGroup || null,
      friendIds: data.friendIds || []
    });
  });

  return users;
}

// 🔹 4. MongoDB로 마이그레이션
async function migrateFirebaseToMongo() {
  await connectMongo();

  const firebaseUsers = await getFirebaseUsers();
  console.log(`💡 Total users to migrate: ${firebaseUsers.length}`);

  for (const userData of firebaseUsers) {
    try {
      await User.updateOne(
        { _id: userData._id }, // 이미 있으면 업데이트
        { $set: userData },
        { upsert: true } // 없으면 새로 생성
      );
      console.log(`✅ Migrated user: ${userData._id}`);
    } catch (err) {
      console.error(`❌ Error migrating user ${userData._id}:`, err);
    }
  }

  mongoose.disconnect();
  console.log('🎉 Migration completed!');
}

// 🔹 5. 실행
migrateFirebaseToMongo();
