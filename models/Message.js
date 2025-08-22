const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    // 메시지가 속한 채팅방 ID
    chatRoomId: {
        type: String,
        required: true,
        ref: 'ChatRoom'
    },
    // 메시지 보낸 사람의 ID
    senderId: {
        type: String,
        required: true
    },
    // 메시지 내용
    content: {
        type: String,
        required: true
    },
    // 전송 시간
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Message', MessageSchema);