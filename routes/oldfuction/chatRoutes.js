const express = require('express');
const chatController = require('../controllers/chatController');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();

// 사용자 ID로 채팅방 목록 가져오기
router.get('/users/:userId/chat_rooms', isAuthenticated, chatController.getChatRooms);

// 채팅방 생성 API
router.post('/chat-rooms', isAuthenticated, chatController.getOrCreateChatRoom);

module.exports = router;
