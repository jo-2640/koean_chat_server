const mongoose = require('mongoose');

const ChatRoomSchema =  new mongoose.Schema({

    _id: {
        type: String,
        required: true
    },

    participants: {
        type: [String],
        required: true,
        validate: {
            validator: function(v){
                return v.length === 2; // 1:1 채팅이므로 참여자는 2명
            },
            message: props => `${props.value} is not a valid list of participants. 1:1 chat requires 2 paricipants.`
        }
    },

    //마지막 메시지 ID
    lastMessageId: {
        type: String,
        ref: 'Message'
    },
    // 마지막 메시지 내용 (간편한 표시용)
    lastMesssageContent: {
        type: String,
        default: ''
    },
    //마지막 메세지 전송 시간
    lastMessageTimestamp:{
        type: Date,
        default: Date.now
    }
}, {
     timestamps: true
});

module.exports = mongoose.model('ChatRoom' , ChatRoomSchema);