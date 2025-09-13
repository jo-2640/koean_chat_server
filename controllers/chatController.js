const ChatRoomSchema = require('../models/ChatRoom');
const UserSchema = require('../models/User');
const FriendShipSchema = require('../models/FriendShip');
exports.getChatRooms = async (req, res) => {
    const userId = req.params.userId;

    try {
        // ✅ 1. 'participants' 필드를 사용하고, populate로 사용자 정보를 한 번에 가져옵니다.
        const rooms = await ChatRoomSchema.find({ participants: userId })
            .populate('participants') // 'participants' 필드에 연결된 사용자 정보를 채웁니다.
            .lean();

        // ✅ 2. friendUser 객체와 unreadCount를 구성합니다.
        const roomsWithFriend = rooms.map(room => {
            // 현재 모델은 1:1 채팅만 지원하므로, participants의 길이는 항상 2입니다.
            const friendUser = room.participants.find(user => user._id.toString() !== userId);
            
            // 향후 그룹 채팅을 위해 isGroup 로직을 남겨둡니다.
            if (!friendUser) {
                // 이 경우는 그룹 채팅이거나, 데이터 오류일 수 있습니다.
                return {
                    ...room,
                    friendUser: null,
                    unreadCount: 0
                };
            }

            return {
                ...room,
                friendUser: {
                    id: friendUser._id,
                    nickname: friendUser.nickname,
                    profileImageUrl: friendUser.profileImageUrl,
                    isOnline: friendUser.isOnline // User 모델에 isOnline 필드가 있다고 가정
                },
                // unreadCount 필드는 현재 ChatRoom 모델에 없으므로 0으로 가정합니다.
                unreadCount: 0 
            };
        });

        res.json(roomsWithFriend);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: '채팅방을 가져오는 데 실패했습니다.' });
    }
};
// 채팅방 생성
exports.getOrCreateChatRoom = async (req, res) => {
  console.log("💚 채팅방 생성 또는 찾기 요청 도착");
  try {
    const currentUserId = req.user.uid;
    const { friendId } = req.body;

    if (!friendId) {
      return res.status(400).json({ message: "친구 ID가 필요합니다." });
    }

    // 1️⃣ 친구 관계 확인: 두 사용자가 실제로 친구인지 확인합니다.
    const friendship = await FriendShipSchema.findOne({
      $or: [
        { user1: currentUserId, user2: friendId },
        { user1: friendId, user2: currentUserId }
      ]
    });

    if (!friendship || friendship.status !== 'accepted') {
      // 친구 관계가 없거나 수락되지 않았을 경우
      console.log("💔 친구 관계가 아니므로 채팅방을 만들 수 없습니다.");
      return res.status(403).json({ message: "친구 관계가 아닙니다. 채팅방을 만들 수 없습니다." });
    }

    // 2️⃣ 채팅방을 찾거나 새로 생성하고, 바로 참여자 정보를 채워넣습니다.
    const participants = [currentUserId, friendId].sort();
    
    let room = await ChatRoomSchema.findOneAndUpdate(
      { participants: { $all: participants, $size: participants.length } },
      { $setOnInsert: { 
          participants, 
          lastMessageTimestamp: Date.now() 
        } 
      },
      { 
        new: true, // 새로운 문서를 반환하도록 설정
        upsert: true // 문서가 없으면 새로 생성하도록 설정
      }
    ).populate('participants', '_id nickname profileImgUrl gender');

    console.log("✅ 채팅방 작업 완료");
    res.status(200).json(room);

  } catch (error) {
    console.error("💔 채팅방 생성 실패:", error);
    res.status(500).json({ message: "채팅방 생성 실패" });
  }
};