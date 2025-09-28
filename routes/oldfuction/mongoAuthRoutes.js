const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { isAuthenticated } = require('../middleware/auth');
const User = require('../models/User');
const Friendship = require('../models/FriendShip'); // Friendship 모델을 추가
const Notification = require('../models/Notification'); // ✅ 이 줄을 추가
router.post('/mongo-signup', async (req, res) => {
  console.log(`✅ mongo-signup 요청 처리 완료`);
  console.log('➡️ 수신된 req.body:', req.body); // ✅ 이 코드를 추가
  try {
    const { uid, email, nickname, bio, birthYear, region, gender, minAgeGroup, maxAgeGroup, profileImgUrl, statusMessage } = req.body;

    if (!uid || !email || !nickname) {
      return res.status(400).json({ message: 'UID, 이메일, 닉네임은 필수입니다.' });
    }

    const newUser = new User({
      _id: uid, email, nickname, bio, birthYear, region, gender, minAgeGroup, maxAgeGroup, profileImgUrl, statusMessage,
    });
    await newUser.save();

    console.log(`✅ 새로운 사용자 등록: ${nickname} (UID: ${uid})`);
    res.status(201).json({ message: '회원가입이 성공적으로 완료되었습니다.' });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: '이미 존재하는 사용자입니다.' });
    }
    console.error('💔 서버 오류:', error);
    res.status(500).json({ message: '내부 서버 오류가 발생했습니다.' });
  }
});

// ✅ 단일 사용자 정보 가져오기 API (GET /api/users/:uid)
router.get('/users/:uid', isAuthenticated, async (req, res) => {
  console.log('fetchuserbyid');
  try {
    const uid = req.params.uid;
    console.log(uid);
    const user = await User.findOne({ _id: uid });

    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    console.log(`✅ 사용자 ${uid} 정보 요청 처리 완료`);
    res.status(200).json(user);
  } catch (error) {
    console.error(`💔 사용자 정보 로딩 중 오류: ${error}`);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

router.get('/getUserData', isAuthenticated, async (req, res) => {
  console.log('💚 통합 사용자 데이터 요청 도착');

  try {
    const currentUserId = req.user.uid;

    const currentUser = await User.findById(currentUserId);
    

    // ✅ 모든 데이터를 하나의 객체로 묶어 전송
    const responseData = {
      user: currentUser,
    };
    console.log('📦 응답 데이터 준비 완료');

    console.log('✅ 통합 사용자 데이터 전송 완료');
    res.status(200).json(responseData);
  } catch (err) {
    console.error('💔 통합 데이터 로딩 중 오류:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 전체 사용자 조회 (자신 제외, 친구 상태 포함, 접속 여부)
router.get('/alluser', isAuthenticated, async (req, res) => {
  console.log("채팅전체유저목록 요청 도착");

  try {
    const currentUserId = req.user.uid;
    console.log("🔑 currentUserId:", currentUserId);

    // 1️⃣ 현재 사용자와 친구인 UID 리스트 조회
    const friendships = await Friendship.find({
      $or: [{ requester: currentUserId, status: 'accepted' }, { recipient: currentUserId, status: 'accepted' }]
    }).lean();

    const friendIds = friendships.map(f =>
      f.requester.toString() === currentUserId ? f.recipient.toString() : f.requester.toString()
    );

    console.log("👬 friendIds:", friendIds);

    // 2️⃣ 전체 유저 조회 (본인과 친구 모두 제외)
    const users = await User.find({
      _id: { $nin: [...friendIds, currentUserId] }
    }).limit(50).lean();

    // 3️⃣ 접속자 맵 가져오기
    const ioUsers = req.app.get('users');

    // 4️⃣ 온라인 상태 붙이기 (모두 친구가 아닌 유저만 남음)
    const usersWithStatus = users.map(user => {
      const isOnline = !!ioUsers?.[user._id.toString()];
      return {
        ...user,
        id: user._id,
        friendshipStatus: 'none',
        isOnline,
      };
    });

    res.json(usersWithStatus);

  } catch (err) {
    console.error('💔 Mongo 사용자 로드 중 오류:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;