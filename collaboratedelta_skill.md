# 🧠 Collaborative Editor using QuillJS + Socket.IO

## Core Idea

A collaborative editor is NOT a chat application.

Instead of sending full text, we send **Deltas (changes)**.

QuillJS provides a Delta format that represents operations like:

* Insert text
* Delete text
* Format text

---

## ⚙️ Architecture Overview

### Components:

* Frontend: Quill Editor
* Backend: Node.js + Socket.IO
* Rooms: Used to isolate collaboration sessions

---

## 🔁 Flow of Collaboration

### 1. Capture User Changes

```js
quill.on('text-change', (delta, oldDelta, source) => {
    if (source === 'user') {
        socket.emit('send-changes', delta);
    }
});
```

---

### 2. Broadcast Changes to Room

```js
socket.on('send-changes', (delta) => {
    socket.broadcast.to(roomId).emit('receive-changes', delta);
});
```

---

### 3. Apply Changes on Other Clients

```js
socket.on('receive-changes', (delta) => {
    quill.updateContents(delta);
});
```

---

## 💾 Initial Document Sync

### Server:

```js
let document = {};

socket.on('get-document', (roomId) => {
    socket.join(roomId);
    socket.emit('load-document', document[roomId] || "");
});
```

### Client:

```js
socket.emit('get-document', roomId);

socket.on('load-document', (doc) => {
    quill.setContents(doc);
});
```

---

## 💾 Auto Save Document

### Client:

```js
setInterval(() => {
    socket.emit('save-document', quill.getContents());
}, 2000);
```

### Server:

```js
socket.on('save-document', (data) => {
    document[roomId] = data;
});
```

---

## ⚠️ Common Mistakes

### ❌ Sending Full HTML

Use:

```js
quill.getContents()
```

NOT:

```js
quill.root.innerHTML
```

---

### ❌ Infinite Loop

Fix:

```js
if (source === 'user')
```

---

### ❌ Overwriting Content

Use:

```js
quill.updateContents()
```

NOT:

```js
quill.setContents()
```

---

## 🧩 Minimum Working Setup

To build a working collaborative editor:

1. Capture Quill changes
2. Send Delta via Socket.IO
3. Broadcast to room
4. Apply Delta using updateContents
5. Load initial document

---

## 🚀 Next Improvements

* Cursor tracking (multi-user cursors)
* User presence (who is online)
* Persistent storage (MongoDB)
* Conflict handling (OT / CRDT)

---

## 🧱 Mental Model

> You are NOT sending text. You are sending operations.

Examples:

* Insert "Hello" at position 5
* Delete 3 characters
* Apply bold formatting

This is what makes real-time collaboration possible.
