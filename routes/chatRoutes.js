const express = require('express');
const router = express.Router();
const ChatRoom = require('../models/ChatRoom');

//채팅방 생성 또는 찾기 API

router.post('/chats', async (req, res) =>) {
    try{
        const { currentUserId, friendId } = req.body;
        const participants =  [currentUserId, friendId].sort();

        let chatRoom = await ChatRoom.findById(chatRoomId);

        if(!chatRoom){
            chatRoom = new ChatRoom({
                _id: chatRoomId,
                participants: participants
            });
            await chatRoom.save();
            console.log(`💚 A new chat room hs been created: ${chatRoomId}`);
        } else {
            console.log(`💚 Found an existing chat room: ${chatRoomId}`);
        }

        res.status(200).json({chatRoomId: chatRoom._id});
    } catch (error){
        console.error("Error creating/finding chat room:", error);
        res.status(500).json({ message: "(💔)A server error occurred."});
    }
});

module.exports = router;