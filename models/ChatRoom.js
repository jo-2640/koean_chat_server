const mongoose = require('mongoose');

const ChatRoomSchema = new mongoose.Schema({

   

    // ✅ participants 필드를 'User' 모델을 참조하는 ObjectId 배열로 변경합니다.
    participants: {
        type: [String],
        ref: 'User', // 'User' 모델을 참조함을 명시합니다.
        required: true,
        validate: {
            validator: function(v){
                return v.length === 2; // 1:1 채팅이므로 참여자는 2명
            },
            message: props => `${props.value} is not a valid list of participants. 1:1 chat requires 2 participants.`
        }
    },

    // 마지막 메시지 ID
    lastMessageId: {
        type: String,
        ref: 'Message'
    },
    // 마지막 메시지 내용 (간편한 표시용)
    lastMessageContent: {
        type: String,
        default: ''
    },
    // 마지막 메세지 전송 시간
    lastMessageTimestamp:{
        type: Date,
        default: Date.now
    }
}, {
      timestamps: true
});

// 🔹 여기서 인덱스 설정
ChatRoomSchema.index({ participants: 1 });
module.exports = mongoose.model('ChatRoom', ChatRoomSchema);