const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const Friendship = require('../models/FriendShip');
const User = require('../models/User');

router.get('/users/paginated', isAuthenticated, async (req, res) => {
    console.log('사용자 목록');
    try {
        const currentUserId = req.user.uid;
        const { page = 1, limit = 50 } = req.query;
        const skip = (page - 1) * limit;
        
        // 1. 현재 사용자의 모든 'accepted' 친구 관계를 조회합니다.
        const friendships = await Friendship.find({
            $or: [
                { senderId: currentUserId, status: 'accepted' },
                { recipientId: currentUserId, status: 'accepted' }
            ]
        });

        // 2. 친구 관계 문서에서 친구들의 ID를 추출합니다.
        const friendIds = friendships.map(friendship => {
            return friendship.senderId === currentUserId ? friendship.recipientId : friendship.senderId;
        });

        // 3. '나'와 '친구들'을 모두 제외한 사용자 목록을 찾습니다.
        const users = await User.find({
            _id: {
                $nin: [currentUserId, ...friendIds] // ✅ $nin 연산자를 사용해 '나'와 '친구들'을 제외합니다.
            }
        })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .select('_id nickname profileImgUrl statusMessage gender')
        .lean(); // lean()을 사용해 가벼운 POJO(Plain Old JavaScript Object)를 반환하여 성능을 최적화합니다.

        res.status(200).json(users);

    } catch (err) {
        console.error('💔 사용자 목록 로드 중 오류:', err);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

module.exports = router;