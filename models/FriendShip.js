const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const FriendShipSchema = new Schema({
  senderId: { 
    type: String, 
    ref: 'User', 
    required: true,
  },
  recipientId: { 
    type: String, 
    ref: 'User', 
    required: true,
  },
  status: { 
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled', 'blocked', 'removed'],  
    default: 'pending'
  },
}, 
{ timestamps: true });


// 두 사용자 간에 하나의 Friendship 문서만 존재하도록 하는 유니크 인덱스 설정
// 이렇게 하면 A가 B에게 요청을 보내고, B가 A에게 요청을 다시 보내는 중복 생성을 막을 수 있습니다.
FriendShipSchema.index({ senderId: 1, recipientId: 1 }, { unique: true });


module.exports = mongoose.model('Friendship', FriendShipSchema);