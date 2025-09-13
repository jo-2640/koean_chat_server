const express = require('express');
const router = express.Router();
const ChatRoom = require('../models/ChatRoom');
const User = require('../models/User');
const { getAuth } = require('firebase-admin/auth');
const chatController = require('../controllers/chatController');
const { isAuthenticated } = require('../middleware/auth');
const Notification = require('../models/Notification');
const { userIdToSocketId } = require('../socket/socket_handler');
const { getRecipientId } = require('../socket/socket_handler');
const mongoose = require('mongoose');
const Friendship = require('../models/FriendShip');

//모든 populate 호출에 이 필드들을 사용합니다.
// A standard set of fields for a public user profile
const userPublicFields = '_id nickname gender profileImgUrl';

// Fields specifically for friends, including a status message and online status
const userFriendFields = '_id nickname gender profileImgUrl statusMessage ';

// A full set of fields for the user's own profile
const userFullProfileFields = '_id nickname gender profileImgUrl statusMessage birthYear';
// ----------------------------------------------------
// ✅ 보안 강화된 API 라우트
// ----------------------------------------------------
// GET /api/friends
router.get('/friendShip', isAuthenticated, async (req, res) => {
    console.error('친구 목록 요청들옴');
    try {
        const currentUserId = req.user.uid; // 인증 미들웨어를 통해 현재 사용자 ID를 가져옴

        // ✅ 1. 'accepted' 또는 'blocked' 상태인 친구 관계를 찾습니다.
        const friendships = await Friendship.find({
            status: { $in: ['accepted', 'blocked'] },
            $or: [
                { senderId: currentUserId },
                { recipientId: currentUserId }
            ]
        })
        .lean()
        .populate('senderId', userFriendFields) // senderId의 전체 사용자 정보 로드
        .populate('recipientId', userFriendFields); // recipientId의 전체 사용자 정보 로드
        // ✅ 2. 각 관계 문서에서 나를 제외한 상대방의 정보를 추출합니다.
        const friends = friendships.map(friendship => {
            // senderId가 내가 아니면 그 사람이 친구입니다.
            if (friendship.senderId._id.toString() !== currentUserId) {
                // 친구의 상태 정보도 함께 반환
                return {
                    ...friendship.senderId,
                    friendshipDocId: friendship._id,
                    status: friendship.status
                };
            } 
            // recipientId가 내가 아니면 그 사람이 친구입니다.
            else {
                return {
                    ...friendship.recipientId,
                    friendshipDocId: friendship._id,
                    status: friendship.status
                };
            }
        });

        // ✅ 3. 정리된 친구 목록 데이터를 클라이언트로 보냅니다.
        res.status(200).json(friends);
    } catch (error) {
        console.error('친구 목록 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// 라우터 파일에서 이 함수를 연결
// router.get('/friends', authMiddleware, getFriends);
router.get('/friends', isAuthenticated, async (req, res) => {
    console.log('💚 친구 목록 요청 도착');
    const userId = req.user.uid;
    const { status, type } = req.query; 

    // ✅ STEP 1: 모든 쿼리는 항상 현재 사용자로 한정하는 기본 쿼리에서 시작합니다.
    let query = {
        $or: [
            { senderId: userId }, 
            { recipientId: userId }
        ]
    };

    // ✅ STEP 2: 쿼리 파라미터에 따라 기본 쿼리에 조건을 추가합니다.
    // 'type'이 'sent' 또는 'received'일 경우
    if (type) {
        if (type === 'sent') {
            query = { status: 'pending', senderId: userId };
        } else if (type === 'received') {
            query = { status: 'pending', recipientId: userId };
        }
    } 
    // 'status' 파라미터가 있고 'type' 파라미터가 없는 경우
    else if (status) {
        // 기본 쿼리에 status 조건만 추가
        query.status = status;
    }
    // ✅ 쿼리 파라미터가 아무것도 없는 경우는 STEP 1의 기본 쿼리가 그대로 사용됩니다.

    try {
    const friendShips = await Friendship.find(query)
        .populate('senderId', userFriendFields)
        .populate('recipientId', userFriendFields)
        .lean();

    // Convert each Friendship document into a Notification-like object
    const notification = friendShips.map(doc => ({
        _id: doc._id, // This will be the Notification's own ID
        friendShipDocId: doc._id, // This is the key change: map Friendship's _id to friendShipDocId
        status: doc.status,
        senderId: doc.senderId,
        recipientId: doc.recipientId,
        isRead: false, // You might need to adjust this depending on your logic
        type: doc.status === 'pending' ? 'friend_request' : 'friend_status_update', 
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    }));

    res.status(200).json(notification);
    } catch (err) {
        console.error('💔 친구 관계 로드 중 오류:', err);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// 친구 요청 보내기 API
router.post('/friends/add', isAuthenticated, async (req, res) => {
    console.log('💚 친구 요청 보내기 요청 도착');
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { recipientId } = req.body;
        const currentUserId = req.user.uid;
        const senderId = currentUserId;

        console.log(`📌 senderId=${senderId}, recipientId=${recipientId}`);

        if (senderId === recipientId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: '자기 자신에게 친구 요청을 보낼 수 없습니다.' });
        }

        const isAlreadyFriends = await Friendship.exists({
            $or: [
                { senderId: senderId, recipientId: recipientId, status: 'accepted' },
                { senderId: recipientId, recipientId: senderId, status: 'accepted' }
            ]
        });

        if (isAlreadyFriends) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: '이미 친구인 사용자입니다.' });
        }

        const friendShip = await Friendship.findOneAndUpdate(
            { senderId: senderId, recipientId: recipientId },
            { $set: { senderId, recipientId, status: 'pending' } },
            { upsert: true, new: true, runValidators: true, session }
        )
        console.log(`💚 Friendship upsert 완료: _id=${friendShip._id}, status=${friendShip.status}`);

      
        const notification = await Notification.findOneAndUpdate(
            { friendShipDocId: friendShip._id },
            {
                $set: {
                    recipientId: friendShip.recipientId,
                    senderId: friendShip.senderId,
                    status: 'pending',
                    isRead: false,
                    type: 'friend_request',
                    friendShipDocId: friendShip._id
                }
            },
            { new: true, upsert: true, session }
        )
        .populate('senderId', userPublicFields) 
        .populate('recipientId', userPublicFields)
        .lean();   

        console.log('💚 Notification upsert 완료:', JSON.stringify(notification, null, 2));

        const io = req.app.get('io');
        const users = req.app.get('users');
        const recipientSocketId = users?.[recipientId];

        if (io && recipientSocketId) {
            io.to(recipientSocketId).emit('friend_request', notification );
            console.log(`💚 실시간 알림 전송 완료: recipientId=${recipientId}`);
        } else {
            console.log(`💔 수신자 ${recipientId} 오프라인`);
        }

        await session.commitTransaction();
        session.endSession();
        res.status(200).json(notification);

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error('💔 친구 요청 중 오류:', err);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// ✅ 친구 요청 취소
router.post('/friends/cancel', isAuthenticated, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { friendShipDocId } = req.body;
        const currentUserId = req.user.uid;
        console.log('➡️ 취소 요청 ID:', friendShipDocId);

        // 보안을 위해 요청자가 sender인지 확인
        const friendShip = await Friendship.findOneAndUpdate(
            { _id: friendShipDocId, senderId: currentUserId, status: 'pending' },
            { status: 'cancelled' },
            { new: true, session }
        )

        if (!friendShip) {
            await session.abortTransaction();
            session.endSession();
            console.warn(`⚠️ 친구 요청 취소 실패: ID ${friendShipDocId}에 대한 유효한 요청을 찾을 수 없습니다.`);
            return res.status(404).json({ message: '요청을 찾을 수 없거나 이미 취소되었습니다.' });
        }

        const recipientId = friendShip.recipientId;
        // 🔹 3초 딜레이 추가
        //await new Promise(resolve => setTimeout(resolve, 3000));
            
        // ✅ Notification 상태를 'cancelled'로 업데이트하고 populate
        const notification = await Notification.findOneAndUpdate(
            { friendShipDocId: friendShip._id , type: 'friend_request'},
            { $set: { status: 'cancelled', type: 'friend_cancelled' , isRead: true } },
            { new: true, session }
        )
        .lean()
        .populate('senderId', userPublicFields)
        .populate('recipientId', userPublicFields);

        if (!notification) {
            console.warn(`⚠️ 알림 업데이트 실패: 알림을 찾지 못했습니다.`);
        }

        // 3. socket.io를 통해 상대방에게 실시간 알림 전송
        const io = req.app.get('io');
        const users = req.app.get('users');
        const recipientSocketId = users?.[recipientId];

        if (io && recipientSocketId) {
            io.to(recipientSocketId).emit('friend_cancelled', notification);
            console.log('✅ Socket.IO가 전송하는 friend_cancelled 데이터:', JSON.stringify(notification, null, 2));
            console.log(`💚 친구 요청 취소 실시간 알림을 ${recipientId}에게 보냈습니다.`);
        } else

        await session.commitTransaction();
        session.endSession();
        console.log(`💡 사용자 ${currentUserId}의 친구 요청이 ${recipientId}에게 성공적으로 취소되었습니다.`);
        res.status(200).json(notification);
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('💔 친구요청 취소 중 오류 발생:', error);
        res.status(500).json({ message: '친구요청 취소에 실패했습니다.' });
    }
});

//알림
// backend/routes/mongoUserRoutes.js

// ✅ 알림 목록
router.get('/notifications', isAuthenticated, async (req, res) => {
    try {
        console.log('💚 초기 알림 목록 로딩');
        const currentUserId = req.user.uid;

        const notifications = await Notification.find({
            recipientId: currentUserId,
            isRead: false
        })
        .lean()
        .populate('senderId', userPublicFields).sort({ createdAt: -1 }); // ✅ populate 유지

        console.log(`✅ 서버가 클라이언트에게 보내는 알림 데이터:`, JSON.stringify(notifications, null, 2));
        res.status(200).json(notifications);

    } catch (err) {
        console.error('💔 알림을 가져오는 중 오류:', err);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// ✅ 친구 요청 수락
router.post('/friends/accept', isAuthenticated, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    console.log('💚 친구 요청 수락 요청 도착');
    try {
        const { friendShipDocId } = req.body;
        const currentUserId = req.user.uid;

        // 1. 기존의 pending 상태 Friendship 문서를 찾고 'accepted'로 변경
        // 보안을 위해 현재 사용자가 recipient인지 확인
        const friendShip = await Friendship.findOneAndUpdate(
            { _id: friendShipDocId, recipientId: currentUserId, status: 'pending' },
            { $set: { status: 'accepted' } },
            { new: true, session }
        );

        if (!friendShip) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: '유효하지 않거나 이미 처리된 친구 요청입니다.' });
        }
 await new Promise(resolve => setTimeout(resolve, 3000));
        // 3. 기존의 'pending' 알림을 'accepted' 상태로 업데이트
        const notification = await Notification.findOneAndUpdate(
            { friendShipDocId: friendShip._id },
            {
                $set: {
                    status: 'accepted',
                    isRead: true,
                    type: 'friend_accepted'
                }
            },
            { new: true, session }
        )
        .lean()
        .populate('senderId', userPublicFields)
        .populate('recipientId', userPublicFields);

        if (!notification) {
            console.warn(`⚠️ 알림 업데이트 실패: 알림을 찾지 못했습니다.`);
        }

        // 4. Socket.IO를 통해 요청자에게만 실시간 알림 전송
        const io = req.app.get('io');
        const users = req.app.get('users');
        const requesterSocketId = users?.[friendShip.senderId];

        if (io && requesterSocketId) {
            // ✅ friend_accepted 로변경
            io.to(requesterSocketId).emit('friend_accepted', { notification });
            console.log(`✅ 친구 요청 수락 실시간 알림을 ${friendShip.senderId}에게 보냈습니다.`);
        }

        await session.commitTransaction();
        session.endSession();
        res.status(200).json(notification);
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error('💔 친구 요청 수락 중 오류:', err);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});


// ✅ 친구 요청 거절
router.post('/friends/reject', isAuthenticated, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { friendShipDocId } = req.body;
        const currentUserId = req.user.uid;

        // 보안을 위해 현재 사용자가 recipient인지 확인
        const friendShip = await Friendship.findOneAndUpdate(
            { _id: friendShipDocId, recipientId: currentUserId, status: 'pending' },
            { $set: { status: 'rejected' } },
            { new: true, session }
        );
        if (!friendShip) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: '유효하지 않거나 이미 처리된 친구 요청입니다.' });
        }
 await new Promise(resolve => setTimeout(resolve, 3000));
        // ✅ 요청을 보낸 사람의 알림을 'rejected' 상태로 업데이트
        const notification = await Notification.findOneAndUpdate(
            { friendShipDocId: friendShip._id, type: 'friend_request' },
            { $set: { status: 'rejected',type: 'friend_rejected', updatedAt: new Date() } },
            { new: true, session }
        )
        .lean()
        .populate('senderId', userPublicFields)
        .populate('recipientId', userPublicFields);
        if (!notification) {
            console.warn(`⚠️ 알림 업데이트 실패: 알림을 찾지 못했습니다.`);
        }

        const io = req.app.get('io');
        const users = req.app.get('users');
        const requesterSocketId = users?.[friendShip.senderId]; // sender 필드를 사용

        
        if (io && requesterSocketId) {
            io.to(requesterSocketId).emit('friend_rejected', { notification });
            console.log(`✅ 친구 요청 거절 실시간 알림을 ${friendShip.senderId}에게 보냈습니다.`);
        }

        await session.commitTransaction();
        session.endSession();
        res.status(200).json(notification);
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error('💔 친구 요청 거절 중 오류:', err);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});


// ✅ 친구 삭제 API
router.post('/friends/remove', isAuthenticated, async (req, res) => {
    console.log('💚 친구 삭제 요청 도착');
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { friendShipDocId } = req.body;
        console.log('🔵 받은 friendShipDocId:', friendShipDocId); // ✅ 1. ID 값 확인
        const currentUserId = req.user.uid;

        // 1. 친구 상태를 'removed'로 변경
        const friendShip = await Friendship.findOneAndUpdate(
            { _id: friendShipDocId, $or: [{ senderId: currentUserId }, { recipientId: currentUserId }], status: 'accepted' },
            { status: 'removed' },
            { new: true, session }
        );
        
        console.log('✅ 1. friendship update 결과:', friendShip); // ✅ 2. 업데이트 결과 확인

        if (!friendShip) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: '해당 친구 관계를 찾을 수 없거나 이미 삭제되었습니다.' });
        }

        // 2. 상대방 ID 확인
        const friendId = friendShip.senderId === currentUserId ? friendShip.recipientId : friendShip.senderId;

        // 3. Notification 상태 업데이트
        const notification = await Notification.findOneAndUpdate(
            { friendShipDocId: friendShip._id, type: 'friend_accepted' },
            { $set: { status: 'removed', type: 'friend_removed', isRead: true } },
            { new: true, session }
        )
        .lean()
        .populate('recipientId', userPublicFields)
        .populate('senderId', userPublicFields);
        
        console.log('✅ 2. notification update 결과:', notification); // ✅ 3. 알림 업데이트 결과 확인

        // 4. 실시간 알림 전송
        const io = req.app.get('io');
        const users = req.app.get('users');
        const friendSocketId = users?.[friendId];

        if (io && friendSocketId) {
            io.to(friendSocketId).emit('friend_removed', notification);
            console.log(`✅ 친구 삭제 실시간 알림을 ${friendId}에게 보냈습니다.`);
        }

        await session.commitTransaction();
        session.endSession();

        console.log('✅ 친구 삭제 성공');
        res.status(200).json(notification);

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error('💔 친구 삭제 중 오류:', err);
        console.error('--- 오류 상세 정보:', err.stack); // ✅ 4. 상세한 오류 스택을 기록합니다.
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});


module.exports = router;
