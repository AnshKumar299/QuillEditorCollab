# Scalability Considerations & Current Limitations

This project was designed as a real-time collaborative editor using Socket.IO and Operational Transform (OT). While it performs well for small-to-medium collaborative workloads, there are several architectural bottlenecks that would need to be addressed before operating at internet-scale.

## 1. In-Memory Document Storage

Active documents are stored in server memory:

```js
otRooms = {
  roomId: {
    content,
    version,
    operations,
    queue,
    saveTimer,
    lastEdited
  }
}
```

### Impact

* Faster collaboration due to avoiding database reads on every edit.
* Memory usage grows with:

  * Number of active documents.
  * Size of document content.
  * Size of retained operation history.

### Current Mitigation

* Documents are removed from memory when the last collaborator leaves.
* Operation history is capped using `MAX_HISTORY`; here = 500.

---

## 2. Socket Connection Limits

Each active collaborator maintains a persistent WebSocket connection.

### Impact

Large numbers of concurrent users increase:

* Memory consumption.
* Open socket count.
* Event processing overhead.

A single server can only handle a finite number of concurrent connections before requiring horizontal scaling.

---

## 3. Broadcast Amplification

Every accepted edit is broadcast to all collaborators in the room.

```js
socket.to(docId).emit(...)
```

### Impact

For a room with `N` users:

* One edit generates `N - 1` outbound messages.
* Network traffic grows linearly with room size.

Large collaboration sessions can become network-bound before CPU or memory become bottlenecks.

---

## 4. Operational Transform Processing Cost

When a client falls behind the current document version, the server must transform incoming operations against missed operations.

```js
for (const op of missedOps) {
    transformedDelta = op.delta.transform(transformedDelta, true);
}
```

### Impact

* Additional CPU usage.
* Increased latency under heavy editing workloads.
* Cost grows with retained operation history and collaboration intensity.

---

## 5. Single-Server Architecture

Currently all collaboration state is maintained on a single Node.js instance.

### Impact

* No horizontal scaling.
* No distributed room ownership.
* No load balancing across collaboration servers.

If the server goes down, all active collaboration sessions are interrupted.

---

## 6. Socket.IO Instance Locality

Room state exists only in local server memory.

### Impact

Running multiple backend instances would cause users connected to different servers to see inconsistent document state.

### Future Solution

Introduce:

* Redis Pub/Sub
* Socket.IO Redis Adapter
* Shared state synchronization

to support multi-instance deployments.

---

## 7. Database Write Throughput

Documents are periodically persisted to MongoDB.

### Impact

Under very large workloads:

* Frequent autosaves increase database write pressure.
* Large documents increase write payload size.

### Current Mitigation

Debounced autosaving reduces unnecessary writes during active typing.

---

## 8. Large Document Memory Footprint

Document content is stored entirely in memory while actively edited.

### Impact

Memory usage grows approximately with:

```text
Document Content
+ OT History
+ Socket Metadata
```

A few large active documents are manageable, but thousands of large active documents would require significantly more RAM.

---

## 9. No Document Sharding

All documents are handled by the same application process.

### Impact

The system cannot distribute heavily edited documents across multiple servers.

Large-scale collaborative platforms typically shard document ownership across clusters of collaboration servers.

---

## Current Intended Scale

This architecture is well-suited for:

* Portfolio projects
* Educational collaboration tools
* Team-based collaborative editing
* Small-to-medium user bases

To support internet-scale workloads (hundreds of thousands or millions of concurrent users), the system would require:

* Horizontal scaling
* Redis-backed Socket.IO
* Distributed room ownership
* Document sharding
* Dedicated collaboration servers
* Load balancing
* Event streaming infrastructure
* Advanced persistence strategies
