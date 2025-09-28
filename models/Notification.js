// backend/models/Notification.js

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // 알림을 받는 사람 (친구 요청의 수신자)
  recipientId: {
    type: String,
    required: true,
    ref: 'User'
  },
  // 알림을 보낸 사람 (친구 요청의 요청자)
  senderId: {
    type: String,
    required: true,
    ref: 'User'
  },
  // 클라이언트의 ui를 빠르게 처리하게위해 상대 정보를 찾아서 보내준다.
  otherId: {
    type: String,
    required: true,
    ref: 'User'
  },
  // 알림 유형 (예: 'friend_request',  'chat_message')
   type: {
    type: String,
    enum: ['friend_request', 'chat_message', 'group_invite'], // 필요한 알림 종류 추가 가능
    required: true,
  },
  // 알림의 상태: 'pending', 'accepted', 'rejected' 등
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled'],
    default: 'unread',
  },
    // 알림 내용
  message: {
    type: String,
    default: '',
  },
  friendShipDocId: {
   type: mongoose.Schema.Types.ObjectId, // ✨ 타입을 ObjectId로 변경
    ref: 'Friendship'
  },
  // 알림의 읽음 상태 (추후 필요하면 추가)
  isRead: {
    type: Boolean,
    default: false
  },
 
  // 생성 시간
}, { timestamps: true });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;