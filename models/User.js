const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  _id: {
    type: String, // Firebase UID
    required: true
  },
  nickname: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    unique: true
  },
  profileImgUrl: {
    type: String,
    default: null
  },
  statusMessage: {
    type: String,
    default: null
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  birthYear: {
    type: Number,
    default: null
  },
  bio:{
    type: String,
    default: ''
  },
  gender: {
    type: String, // 'male', 'female', 'other'
    default: null
  },
  region: {
    type: String, // 간단히 시/도나 주소 문자열
    default: null
  },
  minAgeGroup: {
    type: String,
    default: null
  },
  maxAgeGroup: {
    type: String,
    default: null
  },
  }, {
  timestamps: true // createdAt, updatedAt 자동 생성
});

module.exports = mongoose.model('User', UserSchema);
