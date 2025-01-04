# ZoomOSC to Tinode Bridge Mapping

This document describes how ZoomOSC events are mapped to Tinode messages in the bridge.

## Participant Management

### Query Participants
- **ZoomOSC**: `/zoom/list`
- **Tinode Action**: `queryUsers`
- **Description**: Query Zoom participants and match fuzzy username.

### User Online
- **ZoomOSC**: `/zoomosc/user/online`
- **Parameters**: `targetIndex`, `userName`, `galleryIndex`, `zoomId`
- **Tinode Message**: Presence message with "on" status.
- **Description**: Track when a user joins the meeting.

### User Offline
- **ZoomOSC**: `/zoomosc/user/offline`
- **Parameters**: `targetIndex`, `userName`, `galleryIndex`, `zoomId`
- **Tinode Message**: Presence message with "off" status.
- **Description**: Track when a user leaves the meeting.

### Username Changed
- **ZoomOSC**: `/zoomosc/user/userNameChanged`
- **Parameters**: `targetIndex`, `userName`, `galleryIndex`, `zoomId`, `oldUserName`
- **Tinode Message**: Presence message with "upd" status.
- **Description**: Track when a user changes their name.

## Messaging

### Chat All
- **ZoomOSC**: `/zoom/chatAll`
- **Parameters**: `message`
- **Tinode Message**: Publish message to group topic.
- **Description**: Broadcast message to all participants.

### Chat User
- **ZoomOSC**: `/zoomosc/user/chat`
- **Parameters**: `targetIndex`, `userName`, `galleryIndex`, `zoomId`, `message`, `messageId`, `messageType`
- **Tinode Message**: Publish message with sender info.
- **Description**: Individual user chat message.

### Direct Message
- **ZoomOSC**: `/zoom/userName/chat`
- **Parameters**: `userName`, `message`
- **Tinode Message**: Publish message to P2P topic.
- **Description**: Direct message to a specific user.
- **Note**: Ensure `userName` is resolved to the corresponding user ID for proper routing.

## Pinning

### Toggle Pin
- **ZoomOSC**: `/zoom/userName/togglePin`
- **Parameters**: `userName`
- **Tinode Action**: Bot command for pinning.
- **Description**: Pin/unpin user on screen 1.

### Toggle Pin 2
- **ZoomOSC**: `/zoom/userName/togglePin2`
- **Parameters**: `userName`
- **Tinode Action**: Bot command for pinning to screen 2.
- **Description**: Pin/unpin user on screen 2.

## Message Format Examples

### Presence Message (User Online)
```json
{
  "pres": {
    "what": "on",
    "src": "{zoomId}",
    "seq": 0
  }
}
```

### Chat Message
```json
{
  "pub": {
    "topic": "grpZoomMeeting",
    "head": {
      "from": "{userName}",
      "messageId": "{messageId}"
    },
    "content": "{message}"
  }
}
```

## Error Handling
- **User Not Found**: If a message is sent to a user that is not online, return an error message indicating the user is unavailable.
- **Invalid Message Format**: If a message does not conform to the expected format, log the error and notify the sender.

## Notes
- All Tinode messages are sent to the current group topic unless specified otherwise.
- Direct messages use P2P topics with the format `p2p{userId}`.
- Presence messages are used to track user state changes.
- Bot commands can be used for special actions like pinning users.

## Version History
- **v1.0**: Initial mapping document created. 