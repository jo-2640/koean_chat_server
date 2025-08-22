// backend/routes/chatRoutes.js

const express = require('express');
const router = express.Router();
const ChatRoom = require('../models/ChatRoom');
// 💚 getAuth 함수를 불러와야 합니다.
const { getAuth } = require('firebase-admin/auth');

// ✅ auth.js 파일에서 미들웨어를 불러옵니다.
const { isAuthenticated } = require('../middleware/auth');

// ----------------------------------------------------
// ✅ 보안 강화된 API 라우트
// ----------------------------------------------------

// ✅ 채팅방 생성 또는 찾기 API
router.post('/chats', isAuthenticated, async (req, res) => {
    try {
        // ✅ 토큰을 통해 검증된 현재 사용자 ID를 사용합니다.
        const currentUserId = req.user.uid;
        const { friendId } = req.body;

        // 1:1 채팅이므로, 참여자 ID를 정렬하여 고유한 채팅방 ID를 만듭니다.
        const participants = [currentUserId, friendId].sort();
        const chatRoomId = participants.join('_');

        let chatRoom = await ChatRoom.findById(chatRoomId);

        if (!chatRoom) {
            chatRoom = new ChatRoom({
                _id: chatRoomId,
                participants: participants
            });
            await chatRoom.save();
            console.log(`💚 A new chat room has been created: ${chatRoomId}`);
        } else {
            console.log(`💚 Found an existing chat room: ${chatRoomId}`);
        }

        res.status(200).json({ chatRoomId: chatRoom._id });
    } catch (error) {
        console.error("💔Error creating/finding chat room:", error);
        res.status(500).json({ message: "!A server error occurred." });
    }
});

// ✅ 채팅방 목록을 가져오는 API
router.get('/chat-rooms', isAuthenticated, async (req, res) => {
    try {
        // ✅ 이제 URL 파라미터가 아닌, 미들웨어에서 검증된 userId를 사용합니다.
        const userId = req.user.uid;

        // MongoDB에서 해당 사용자가 참여하고 있는 모든 채팅방을 찾습니다.
        const chatRooms = await ChatRoom.find({
            participants: userId
        }).sort({ lastMessageTimestamp: -1 });

        // 찾은 채팅방 목록을 응답으로 보냅니다.
        res.status(200).json(chatRooms);

        console.log(`💚 User ${userId}'s chat rooms have been successfully retrieved.`);

    } catch (error) {
        console.error("💔Error retrieving chat rooms:", error);
        res.status(500).json({ message: "!A server error occurred." });
    }
});

module.exports = router;