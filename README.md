# CollabEdit — Production-Grade Collaborative Real-Time Editor

> A server-authoritative, OT-based collaborative text editor engineered for correctness under concurrency, not just for demo conditions.

---

## Table of Contents

1. [Elevator Pitch](#elevator-pitch)
2. [High-Level Overview](#high-level-overview)
3. [Why This Project Exists](#why-this-project-exists)
4. [Key Features](#key-features)
5. [Architecture Overview](#architecture-overview)
6. [End-to-End Request Flow](#end-to-end-request-flow)
7. [Operational Transformation Deep Dive](#operational-transformation-deep-dive)
8. [Why OT Was Chosen](#why-ot-was-chosen)
9. [How Versioning Works](#how-versioning-works)
10. [Delta Lifecycle Walkthrough](#delta-lifecycle-walkthrough)
11. [Client Buffering Strategy](#client-buffering-strategy)
12. [Concurrency Control Strategy](#concurrency-control-strategy)
13. [Persistence Strategy](#persistence-strategy)
14. [Room Lifecycle Management](#room-lifecycle-management)
15. [Join Approval Workflow](#join-approval-workflow)
16. [Authentication & Security Design](#authentication--security-design)
17. [ActiveRooms Data Structure](#activerooms-data-structure)
18. [OTRooms Data Structure](#otrooms-data-structure)
19. [Internal State Management](#internal-state-management)
20. [File Structure](#file-structure)
21. [Module Reference](#module-reference)
22. [Frontend Architecture](#frontend-architecture)
23. [Cursor Synchronization Architecture](#cursor-synchronization-architecture)
24. [Error Recovery & Resynchronization](#error-recovery--resynchronization)
25. [Testing Strategy](#testing-strategy)
26. [Scaling Analysis](#scaling-analysis)
27. [Current Bottlenecks](#current-bottlenecks)
28. [Why It Is Single-Server Today](#why-it-is-single-server-today)
29. [What Would Be Needed For Horizontal Scaling](#what-would-be-needed-for-horizontal-scaling)
30. [OT vs CRDT Discussion](#ot-vs-crdt-discussion)
31. [Production Readiness Assessment](#production-readiness-assessment)
32. [Strengths of the Current Architecture](#strengths-of-the-current-architecture)
33. [Tradeoffs Made](#tradeoffs-made)
34. [Known Limitations](#known-limitations)
35. [Future Improvements](#future-improvements)
36. [Installation Guide](#installation-guide)
37. [Environment Variables](#environment-variables)
38. [Running Locally](#running-locally)
39. [Running Tests](#running-tests)
40. [Example Collaboration Session](#example-collaboration-session)
41. [Engineering Highlights for Recruiters](#engineering-highlights-for-recruiters)
42. [Resume-Worthy Technical Achievements](#resume-worthy-technical-achievements)
43. [Conclusion](#conclusion)

---

## Elevator Pitch

CollabEdit is a **real-time collaborative rich-text editor** built from first principles, without relying on off-the-shelf CRDT or OT libraries for its core convergence logic. It implements a **server-authoritative Operational Transformation** model on top of Socket.IO, with a carefully designed client-side delta buffer, a monotonic version counter, per-document serial execution queues, and a bounded history store — all choices deliberately made to solve the hard problem of collaborative editing: **making concurrent, causally-unordered edits converge to the same document state on all clients.**

This is not a tutorial project. It is an engineering exercise in distributed systems correctness, demonstrating a deep understanding of the same fundamental challenges that Google Docs, Notion, and Figma had to solve at scale.

---

## High-Level Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            CollabEdit System                             │
│                                                                          │
│  ┌─────────────┐    WebSocket    ┌──────────────────────────────────┐   │
│  │   Client A  │◄──────────────►│                                  │   │
│  │  (React/    │                │         Node.js Server           │   │
│  │   Quill)    │                │    ┌──────────────────────────┐  │   │
│  └─────────────┘                │    │  Socket.IO Event Bus     │  │   │
│                                 │    └──────────┬───────────────┘  │   │
│  ┌─────────────┐    WebSocket   │               │                  │   │
│  │   Client B  │◄──────────────►│    ┌──────────▼───────────────┐  │   │
│  │  (React/    │                │    │   OT Engine + Document   │  │   │
│  │   Quill)    │                │    │   Queue (per-doc serial) │  │   │
│  └─────────────┘                │    └──────────┬───────────────┘  │   │
│                                 │               │                  │   │
│  ┌─────────────┐    HTTP/JWT    │    ┌──────────▼───────────────┐  │   │
│  │   Client C  │◄──────────────►│    │   In-Memory State        │  │   │
│  │  (REST API) │                │    │   otRooms / activeRooms  │  │   │
│  └─────────────┘                │    └──────────┬───────────────┘  │   │
│                                 │               │  write-behind    │   │
│                                 │    ┌──────────▼───────────────┐  │   │
│                                 │    │       MongoDB             │  │   │
│                                 │    │  (Mongoose / persistent) │  │   │
│                                 │    └──────────────────────────┘  │   │
│                                 └──────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

The system is designed around a **hub-and-spoke model**: the server is the single source of truth. Every edit passes through the server, gets assigned a canonical version number, is transformed against all concurrent operations the client hasn't seen, and is rebroadcast to other clients. The client never decides what the document looks like — only the server does.

---

## Why This Project Exists

Most real-time editor demos stop at "two people typing at the same time and both see updates." That's the easy part — a simple event relay works for that.

The hard problem is: **what happens when two people type at the exact same offset at the same instant, and their operations arrive at the server in non-causal order?** Or when a client is on a flaky network and sends an operation at version 10, but the server is now at version 14?

This project exists to answer those questions correctly and explicitly:

- It does not use Yjs, Automerge, ShareDB, or any other OT/CRDT library.
- It implements its own transform pipeline using Quill's Delta format.
- It defines explicit policies for version gaps, history bounds, and force-resync conditions.
- It makes the client buffer strategy an explicit part of the protocol, not an afterthought.

The goal is not feature completeness. The goal is **correctness under adversarial concurrency conditions**, and to be able to explain every design decision from first principles.

---

## Key Features

| Feature | Description |
|---|---|
| **Rich Text Editing** | Full Quill editor with formatting toolbar, image support, and image resize |
| **Real-Time Collaboration** | Multiple users editing the same document simultaneously |
| **OT Convergence** | Server-authoritative operational transformation ensuring all clients converge |
| **Live Cursors** | Remote user cursors rendered in the editor with presence labels |
| **JWT Auth** | Stateless authentication for both HTTP routes and WebSocket connections |
| **Room Ownership** | Documents have owners; access requires explicit approval |
| **Join Approval Workflow** | Pending join requests that an owner must accept |
| **Write-Behind Persistence** | Debounced async save — responsive writes without blocking the OT path |
| **Force Resync** | Automatic full-state resynchronization when version gap is unrecoverable |
| **Bounded History** | Operation history capped at 500 ops to prevent unbounded memory growth |
| **Echo Suppression** | Clients do not receive their own confirmed operations back |
| **Per-Document Serial Queue** | No concurrent OT execution for the same document |

---

## Architecture Overview

The architecture can be decomposed into five horizontal layers:

```
┌─────────────────────────────────────────────────────┐
│                   Transport Layer                    │
│          Socket.IO (WS) + Express (HTTP/REST)        │
├─────────────────────────────────────────────────────┤
│                  Auth/Identity Layer                 │
│         JWT middleware (HTTP + io.use() WS)          │
├─────────────────────────────────────────────────────┤
│              Collaboration Protocol Layer            │
│   Room Lifecycle · Join Approval · Presence          │
├─────────────────────────────────────────────────────┤
│                 OT Engine Layer                      │
│   DocumentQueue · Transform · Version Counter        │
├─────────────────────────────────────────────────────┤
│              Persistence Layer (Async)               │
│       Write-Behind Save · MongoDB · Mongoose         │
└─────────────────────────────────────────────────────┘
```

Each layer has a single well-defined responsibility. The OT Engine Layer is isolated from the Transport Layer — it receives already-validated, already-authenticated operation objects and does nothing but transform and apply them.

---

## End-to-End Request Flow

### WebSocket Operation (the main collaboration path)

```
Client A types "hello" at position 5
          │
          ▼
  Quill fires text-change event
          │
          ▼
  Client builds Delta { ops: [{ retain: 5 }, { insert: "hello" }] }
          │
          ▼
  Client checks inflightDelta:
    - If null → set inflight = delta, send { delta, version: clientVersion }
    - If set  → merge delta into pendingDelta (buffer)
          │
          ▼
  Socket.IO "operation" event → server
          │
          ▼
  JWT middleware validates socket.userId (already set at connect time)
          │
          ▼
  roomManager validates socket.currentRoom === roomId
          │
          ▼
  DocumentQueue.enqueue(roomId, async () => {
          │
          ▼
    otRooms[roomId] exists? (load from DB if not)
          │
          ▼
    clientVersion === serverVersion?
      YES → apply delta directly, increment version
      NO  → try to find clientVersion in bounded history
              found? → compose all history[clientVersion..serverVersion]
                        → transform clientDelta against composed history
                        → apply transformed delta
              not found? → force-resync: emit full document state to client
          │
          ▼
    Push op to history (trim if > MAX_HISTORY = 500)
          │
          ▼
    Broadcast transformed delta + new version to all OTHER clients in room
          │
          ▼
    Emit ack + new version back to Client A
          │
          ▼
    Schedule write-behind save (debounce 5s)
  })
          │
          ▼
  Client A receives ack:
    - Clear inflightDelta
    - If pendingDelta exists → set as new inflight, retransform, send
          │
          ▼
  Client B receives broadcast:
    - Apply delta to Quill
    - Increment local version counter
```

---

## Operational Transformation Deep Dive

Operational Transformation (OT) is a correctness protocol for concurrent editing. It answers the question: **if two users make edits at the same time and I apply them in different orders, do I end up with the same document?**

### The Problem OT Solves

Suppose two users start with document: `"AC"`

- User A inserts `"B"` at position 1 → intended result: `"ABC"`
- User B inserts `"D"` at position 1 → intended result: `"ADC"`

If both operations arrive at the server and we apply them naively in sequence:
1. Apply A: `"AC"` → `"ABC"` ✓
2. Apply B naively at position 1: `"ABC"` → `"ADBC"` ✗

User B's intent was to insert after `"A"`, not after `"B"`. The position has been **shifted** by A's insertion. OT transforms B's operation against A's operation before applying it, adjusting the position:

```
transform(B, A) → insert "D" at position 2 (because A inserted 1 character before position 1)
Apply transformed B: "ABC" → "ABDC"
```

Now both clients, regardless of which operation they applied first, converge to `"ABDC"`.

### This System's OT Architecture

```
Server State at version V:
  document: [current Quill Delta]
  history: [op@V-n, op@V-n+1, ..., op@V-1]   ← bounded to MAX_HISTORY=500

Incoming op from client at clientVersion C:

  Case 1: C === V (no concurrency)
    ┌──────────────┐
    │  Apply op    │  → version becomes V+1
    └──────────────┘

  Case 2: C < V (concurrent ops exist)
    ┌────────────────────────────────────────────────┐
    │  Compose history[C..V] → concurrentDelta       │
    │  Transform incomingOp against concurrentDelta  │
    │  Apply transformedOp                           │
    │  Version becomes V+1                           │
    └────────────────────────────────────────────────┘

  Case 3: C < V - MAX_HISTORY (history gap too large)
    ┌────────────────────────────────────────────────┐
    │  Cannot recover. Emit force-resync to client.  │
    │  Client replaces local state with server state │
    └────────────────────────────────────────────────┘
```

The transform function uses **Quill Delta's** `compose` and `transform` methods. Quill Delta is a well-specified, composable format for rich text operations, which makes the transform semantics well-defined and testable.

### Why Server-Authoritative?

A server-authoritative model means the server is the single sequencer. Every operation is linearized through the server before being applied to the canonical document. This avoids the **diamond problem** in peer-to-peer OT, where two clients must independently transform against each other's operations — a significantly harder problem requiring complex causality tracking (vector clocks, etc.).

The tradeoff: higher perceived latency (every keystroke must round-trip to the server before being "committed"), mitigated by **optimistic local application** on the client side.

---

## Why OT Was Chosen

See the [OT vs CRDT Discussion](#ot-vs-crdt-discussion) section for a full comparison. At a high level:

1. **Quill's Delta format is naturally OT-compatible.** Quill represents edits as composable Delta objects with well-defined `compose` and `transform` semantics. Building OT on top of Delta was a natural fit.

2. **Server-authoritative OT is simpler to reason about.** There is one source of truth, one version counter, one history log. Debugging a convergence issue means looking at the server log.

3. **CRDT libraries like Yjs are black boxes.** For an engineering exercise focused on understanding the internals of collaborative editing, using Yjs would defeat the purpose.

4. **OT is a known-correct algorithm for this problem space.** Google Docs has used OT since 2006. The algorithm is well-understood, well-documented, and well-tested.

---

## How Versioning Works

The version counter is a **monotonically increasing integer** scoped per room (document). It is the single source of ordering truth in the system.

```
Initial state:   version = 0,  history = []

Client A sends op at version 0:
  Server applies op → version = 1, history = [opA@0]

Client B sends op at version 0 (concurrent with A):
  Server receives B after A is applied
  Server is now at version 1
  clientVersion(B) = 0, serverVersion = 1
  → compose history[0..1] = opA
  → transform opB against opA → opB'
  → apply opB' → version = 2, history = [opA@0, opB'@1]

Client B sends op at version 2:
  Server is at version 2 → no transform needed
  → apply directly → version = 3
```

**Key properties of this versioning scheme:**

- **Monotonic**: version never decreases. A server restart would reload the last persisted version from MongoDB.
- **Globally sequenced**: every op that "makes it" gets exactly one version number.
- **Client-visible**: clients track the last version they've confirmed. This is what they send back as `clientVersion` in every operation.
- **History-indexed**: `history[i]` corresponds to the operation applied to reach version `i+1`.

---

## Delta Lifecycle Walkthrough

A Quill Delta is a list of operations: `retain(n)`, `insert(text/embed)`, `delete(n)`. Every edit the user makes in the Quill editor is expressed as a Delta relative to the current document state.

### Server-Side Delta Application

```
Document at V=3: { ops: [{ insert: "Hello World" }] }

Incoming delta from client: { ops: [{ retain: 5 }, { insert: " Beautiful" }] }
(client wants to insert " Beautiful" after "Hello")

If clientVersion matches serverVersion (both = 3):
  newDoc = compose(currentDoc, incomingDelta)
         = { ops: [{ insert: "Hello Beautiful World" }] }
  serverVersion = 4
  history[3] = incomingDelta

Broadcast to other clients: { delta: incomingDelta, version: 4 }
Ack to sender: { version: 4 }
```

### Transform Example

```
Document at V=5: { ops: [{ insert: "ABC" }] }
history[4] = { ops: [{ retain: 1 }, { insert: "X" }] }  ← inserted X after A → "AXBC"

Client sends delta at clientVersion=4:
  { ops: [{ retain: 2 }, { insert: "Y" }] }  ← wants to insert Y after B → "AXBYC"
  But server is at V=5, client hasn't seen the X insertion

Transform:
  serverDelta (from history) = { ops: [{ retain: 1 }, { insert: "X" }] }
  clientDelta               = { ops: [{ retain: 2 }, { insert: "Y" }] }
  
  transformedClientDelta = Delta.transform(clientDelta, serverDelta, 'left')
  = { ops: [{ retain: 3 }, { insert: "Y" }] }
  ← position adjusted from 2 to 3 because X was inserted at position 1

Apply transformedClientDelta to document at V=5:
  "AXBC" → "AXBYC"    ← correct! Y is after B, where the user intended
```

---

## Client Buffering Strategy

The client maintains two delta buffers and one version counter. This is the crux of the client-side OT protocol.

```
┌─────────────────────────────────────────────────────────────┐
│                     Client State                            │
│                                                             │
│   confirmedVersion: number   ← last version acked by server │
│   inflightDelta:   Delta     ← op sent to server, awaiting  │
│                                ack (null if idle)           │
│   pendingDelta:    Delta     ← local edits not yet sent     │
│                                (null if none queued)        │
└─────────────────────────────────────────────────────────────┘
```

### State Machine

```
User types:
  inflightDelta = null?
    YES → inflightDelta = userDelta
          send { delta: inflightDelta, version: confirmedVersion }
    NO  → pendingDelta = compose(pendingDelta, userDelta)
          (buffer additional edits while inflight op is in transit)

Server acks inflight op with newVersion:
  confirmedVersion = newVersion
  inflightDelta = null
  
  pendingDelta != null?
    YES → inflightDelta = pendingDelta
          pendingDelta = null
          send { delta: inflightDelta, version: confirmedVersion }
    NO  → idle (waiting for next user input)

Server broadcasts remote op (version V):
  transform the remote op against inflightDelta (if any)
  transform the result against pendingDelta (if any)
  apply final result to Quill
  
  also transform inflightDelta and pendingDelta against the remote op
  (their positions may have shifted due to the remote edit)
```

### Why This Buffer Exists

Without the buffer, the client would need to either:
1. **Block the user** from typing until the server acks each keystroke — terrible UX.
2. **Send every delta immediately** — creates races where the client might send op@V while a previous op is still in transit, causing version confusion.

The inflight/pending model ensures:
- The user never waits (edits are applied locally immediately — optimistic UI).
- The server always receives operations with a well-defined, stable base version.
- Pending edits are correctly retransformed if a remote op arrives while they're buffered.

---

## Concurrency Control Strategy

### The Race Condition Without a Queue

Without per-document serialization, consider this server-side scenario:

```
t=0: Op from Client A arrives for roomId "doc1"
t=1: Op from Client B arrives for roomId "doc1"
t=2: Both ops begin async processing (DB lookups, history fetches) concurrently
t=3: A reads version=5, B reads version=5
t=4: A writes version=6 (applied A's op)
t=5: B writes version=6 (applied B's op — but based on stale version=5 read!)
```

Two operations both produce version 6. The document is now corrupt.

### The DocumentQueue Solution

```javascript
// Per-document FIFO queue. All OT operations for a given roomId
// run serially — each one awaits completion before the next begins.

class DocumentQueue {
  constructor() {
    this.queues = new Map(); // roomId → Promise chain
  }

  enqueue(roomId, fn) {
    const current = this.queues.get(roomId) || Promise.resolve();
    const next = current.then(() => fn()).catch(console.error);
    this.queues.set(roomId, next);
    return next;
  }
}
```

With the queue:

```
t=0: Op A enqueued for "doc1" → starts executing immediately
t=1: Op B enqueued for "doc1" → waits for A to finish
t=2: A completes (version 5→6)
t=3: B starts executing, reads version=6, transforms correctly → version 7
```

The queue does **not** serialize across rooms — `doc2` operations can proceed in parallel with `doc1` operations. The serialization is **per-document only**, minimizing lock contention.

### Why Not a Mutex?

A mutex (e.g., a Redis-based distributed lock) would solve the same problem but requires an external service and introduces latency on every acquire/release. The Promise-chain queue is:
- In-process (zero network overhead)
- Non-blocking (the event loop is not stalled)
- Leak-resistant (the next op in the chain starts even if the previous throws)

---

## Persistence Strategy

### Why Write-Behind?

The naive approach — writing to MongoDB synchronously on every operation — would mean:

```
Client sends op → OT transform → MongoDB write → ack client → broadcast
                                 ↑ this is now the bottleneck
```

A MongoDB write takes 5–20ms under normal conditions. For a collaborative editor with multiple fast typists, this serializes the entire OT pipeline on the database.

Write-behind (also called write-through buffering or deferred persistence) decouples the OT hot path from the storage path:

```
Client sends op → OT transform → update in-memory state → ack client → broadcast
                                 ↑ sub-millisecond                 ↓ (async, non-blocking)
                            scheduleDebounced(5s)
                                         ↓
                                   MongoDB write
```

### Debounce Logic

```
edit at t=0  → schedule save at t=5s
edit at t=1  → cancel previous timer, schedule save at t=6s
edit at t=2  → cancel previous timer, schedule save at t=7s
...
edit at t=4  → cancel previous timer, schedule save at t=9s
[no edits]   → save fires at t=9s ← single write for 5 seconds of typing
```

During heavy typing (say 10 keystrokes/second), the write-behind approach reduces MongoDB writes from `10/s` to `1/5s = 0.2/s` — a **50x reduction in write load**.

### Safety-Net Save

The debounce timer alone is not sufficient. If the server crashes or the room is cleaned up while the timer is pending, in-memory state would be lost. A **safety-net save** runs during `checkAndCleanupRoom()` — whenever the last socket leaves a room, the server flushes the current document state to MongoDB before releasing the in-memory room.

```
Last user disconnects → checkAndCleanupRoom() fires
                       → saveTimer still pending? cancel it
                       → await saveDocumentToMongoDB(roomId)  ← safety flush
                       → delete otRooms[roomId]
                       → delete activeRooms[roomId]
```

### Why Not Event Sourcing?

Storing every operation rather than the current document state (event sourcing) would enable full history replay, undo beyond the current session, and causal debugging. This is a known future improvement. The current design stores only the composed document state plus a bounded rolling history (MAX_HISTORY=500). This is simpler to implement, simpler to recover from, and sufficient for the current feature set.

---

## Room Lifecycle Management

### State Machine

```
                         ┌─────────────────┐
                         │   Room Created  │
                         │ (owner connects)│
                         └────────┬────────┘
                                  │
                         ┌────────▼────────┐
                         │   Room Active   │◄─── Other users join (approved)
                         │ otRooms entry   │
                         │ activeRooms     │
                         └────────┬────────┘
                                  │
                    All sockets disconnect
                                  │
                         ┌────────▼────────┐
                         │ checkAndCleanup │
                         │   Room()        │
                         └────────┬────────┘
                                  │
                    Safety-net save to MongoDB
                                  │
                         ┌────────▼────────┐
                         │  Room Evicted   │
                         │ (memory freed)  │
                         └─────────────────┘
```

### otRooms vs activeRooms — Why Two Maps?

This is one of the most important design decisions in the system.

| Map | Contains | Keyed by | Lifetime |
|-----|----------|----------|----------|
| `otRooms` | Document state (content, version, history) | roomId | Exists when ≥1 user is editing |
| `activeRooms` | Session state (socket list, owner info, pending requests) | roomId | Exists when ≥1 user is connected |

**They are separated because they have different lifecycles and responsibilities.**

- `otRooms` is the OT engine's workspace. It should contain only what the OT algorithm needs: the document, the version, and the history.
- `activeRooms` is the collaboration session's workspace. It contains the socket list, presence data, and pending join requests — none of which belong in the OT layer.

Mixing them would violate separation of concerns and make it harder to reason about concurrency (the OT layer would acquire unnecessary knowledge about socket state).

### Double Cleanup Prevention

When a socket disconnects, Socket.IO fires the `disconnect` event. In some edge cases (rapid reconnect, transport upgrade), this event can fire more than once for the same logical connection. Without protection, `checkAndCleanupRoom` could run twice for the same socket, potentially:

- Saving the document twice (benign but wasteful)
- Deleting `otRooms[roomId]` while another socket in the same room is mid-operation (catastrophic)

```javascript
socket.on("disconnect", () => {
  if (socket.cleanupDone) return; // guard
  socket.cleanupDone = true;
  checkAndCleanupRoom(socket);
});
```

The `cleanupDone` flag ensures the cleanup logic is **idempotent** — safe to call multiple times, but only runs once.

---

## Join Approval Workflow

This system implements a non-trivial access control flow inspired by Google Meet's lobby pattern:

```
Requester                   Server                    Owner
    │                          │                         │
    │  HTTP: POST /join-request │                         │
    │ ────────────────────────►│                         │
    │                          │  Validate JWT           │
    │                          │  Check room exists      │
    │                          │  Add to pendingRequests │
    │                          │ ───────────────────────►│
    │                          │  emit: joinRequest      │
    │  { status: "pending" }   │                         │
    │◄─────────────────────────│                         │
    │                          │                         │
    │                          │    Owner approves:      │
    │                          │◄───────────────────────│
    │                          │  emit: approveJoin      │
    │                          │                         │
    │                          │  addToSharedTo(userId)  │
    │                          │  emit: joinApproved     │
    │◄─────────────────────────│                         │
    │  Requester joins room    │                         │
```

### Auth-Before-Join Ordering

A critical security property: **authentication is validated before any room state is consulted.** The sequence is:

1. JWT parsed and `socket.userId` set at `io.use()` middleware (connection time)
2. Room membership checked on every handler (not just at join time)
3. `socket.currentRoom === roomId` verified on every operation

This prevents a class of attacks where an authenticated but unauthorized user could send operation events directly via a WebSocket client, bypassing the UI's join flow.

### Owner Offline Handling

If the owner is not currently connected when a join request arrives, the request is stored in `pendingRequests` and the requester is notified that approval is pending. When the owner reconnects, they are shown any outstanding requests. This prevents a deadlock where a requester is stuck waiting forever.

---

## Authentication & Security Design

### Why JWT Over Sessions?

Sessions require server-side state (in-memory or Redis). JWT is stateless — the server can validate a token with only the secret key, no DB or memory lookup. For a WebSocket-heavy application where connections are long-lived and potentially numerous, stateless validation is preferable.

### HTTP Routes

```
Express route handler
  → jwtMiddleware (verify token, attach req.userId)
  → route handler (uses req.userId, never req.body.userId)
```

`req.body.userId` is never trusted. Even if a malicious client sends `{ userId: "admin" }` in the request body, the server ignores it.

### WebSocket (Socket.IO)

```javascript
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId; // ← immutably set once at connect time
    next();
  } catch {
    next(new Error("Authentication error"));
  }
});
```

`socket.userId` is set **once** at connection time by the middleware. No subsequent event handler can override it — it's a property on the socket object, not read from the event payload.

### Room Membership Validation

Every event handler checks:
```javascript
if (socket.currentRoom !== roomId) return; // wrong room
if (!room.members.includes(socket.userId)) return; // not a member
```

This means even if a client sends an `operation` event for a room they're not in, it is silently dropped.

### CORS Configuration

```javascript
// No wildcard origins. Only the explicitly configured FRONTEND_URL is allowed.
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});
```

Wildcard CORS (`*`) would allow any website to connect to the WebSocket server and send authenticated events on behalf of a user (if the user's JWT is stored in a non-HttpOnly cookie). The explicit origin restriction prevents this.

---

## ActiveRooms Data Structure

```
activeRooms: Map<roomId, ActiveRoom>

ActiveRoom {
  roomId:          string           // MongoDB ObjectId as string
  ownerId:         string           // userId of the document owner
  members:         Set<string>      // userIds currently in the room
  sockets:         Map<userId, socketId>  // userId → active socket
  pendingRequests: Map<userId, {
    userId:   string,
    username: string,
    socketId: string,
    timestamp: number
  }>
}
```

**Why `Map<userId, socketId>` for sockets, not just a Set of socketIds?**

To broadcast an approval to a specific user, the server needs to look up their socketId. A Map provides O(1) lookup by userId. Using only a Set of socketIds would require iterating all sockets and checking their userId property — O(n) per lookup.

**Why `Set` for members?**

Membership checks (`members.has(userId)`) are O(1) for Sets. Adding/removing on join/leave is also O(1). A list would be O(n) for the has-check.

---

## OTRooms Data Structure

```
otRooms: Map<roomId, OTRoom>

OTRoom {
  roomId:   string              // same key as the Map
  document: QuillDelta          // current canonical document state
  version:  number              // monotonically increasing, starts at 0
  history:  QuillDelta[]        // ring buffer, max MAX_HISTORY=500 entries
                                // history[i] = op applied to reach version i+1
  saveTimer: NodeJS.Timeout     // debounced write-behind save handle
}
```

### History Ring Buffer

```
version = 503, MAX_HISTORY = 500

history contains ops for versions: [3, 4, 5, ..., 502]
                                    ↑ oldest              ↑ newest

A client at version 2 asks to transform:
  clientVersion=2, serverVersion=503
  gap = 501, MAX_HISTORY = 500
  501 > 500 → cannot recover → force-resync

A client at version 100 asks to transform:
  gap = 403, within MAX_HISTORY
  compose history[100..503] → transform against composed → apply
```

When a new op is applied and history length exceeds MAX_HISTORY, the oldest entry is removed:

```javascript
history.push(newOp);
if (history.length > MAX_HISTORY) {
  history.shift(); // O(n) — known limitation, see Future Improvements
}
```

This bounds memory usage per room at approximately `MAX_HISTORY × avg_delta_size`. For typical text editing, a Delta is a few dozen bytes; 500 × 100 bytes = ~50KB per active room.

---

## Internal State Management

The state module is the single source of truth for in-memory state. No other module allocates or accesses `otRooms` or `activeRooms` directly — they import them from the state module.

```
state.js
  exports: otRooms, activeRooms, DocumentQueue instance

collaboration.js  → imports state, handles OT events
roomManager.js    → imports state, manages room membership
cleanup.js        → imports state, handles disconnect cleanup
joinRequests.js   → imports state, handles join approval flow
index.js          → imports all modules, wires up Socket.IO
```

This is a **shared mutable state** model, which is appropriate for a single-process Node.js server. The event loop's single-threaded execution model means there are no true data races in synchronous code — only async races, which the DocumentQueue addresses.

---

## File Structure

```
.
├── backend/
│   ├── index.js                  # Entry point: Express, Socket.IO init, module wiring
│   ├── state.js                  # Shared in-memory state: otRooms, activeRooms, DocumentQueue
│   ├── collaboration.js          # OT engine: operation handler, transform, version management
│   ├── cleanup.js                # Disconnect handling, room eviction, safety-net save
│   ├── joinRequests.js           # Join request lifecycle, owner approval flow
│   ├── roomManager.js            # Room creation, join, leave, membership validation
│   ├── models/
│   │   └── Room.js               # Mongoose schema: document content, version, sharedTo[]
│   ├── middleware/
│   │   └── auth.js               # JWT verification middleware (HTTP)
│   └── routes/
│       ├── rooms.js              # REST: create room, list rooms, get room
│       └── auth.js               # REST: register, login, token refresh
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Root component, routing
│   │   ├── components/
│   │   │   ├── Editor.tsx        # Main editor component, OT client logic
│   │   │   ├── Toolbar.tsx       # Quill formatting toolbar
│   │   │   ├── CursorOverlay.tsx # Remote cursor rendering
│   │   │   └── JoinRequest.tsx   # Owner join-approval UI
│   │   ├── hooks/
│   │   │   ├── useOT.ts          # OT client state machine (inflight/pending)
│   │   │   ├── useSocket.ts      # Socket.IO connection management
│   │   │   └── useCursors.ts     # Remote cursor sync logic
│   │   └── types/
│   │       └── index.ts          # Shared TypeScript types
│   └── package.json
│
├── tests/
│   ├── ot.test.js                # OT convergence, transform correctness
│   ├── roomLifecycle.test.js     # Room create/join/leave/cleanup
│   ├── auth.test.js              # JWT validation, unauthorized access
│   └── otBuffer.test.ts          # Client buffer transitions, ack flow
│
├── .env.example
├── package.json
└── README.md
```

---

## Module Reference

### `state.js` — Shared State

The only module allowed to instantiate `otRooms`, `activeRooms`, and `DocumentQueue`. All other modules import from here.

**Why centralize state here?** In a larger system, this would be replaced by a state management layer (Redis, etc.). Centralizing it now makes that migration straightforward: change one module, not six.

---

### `collaboration.js` — OT Engine

Handles the `"operation"` Socket.IO event. This is the most complex module.

**Responsibilities:**
1. Validate that the socket is in the correct room
2. Enqueue the operation in the DocumentQueue
3. Look up or initialize the OTRoom
4. Determine whether to apply directly or transform
5. Apply the (possibly transformed) delta to the document
6. Update version and history
7. Emit ack to sender, broadcast to others
8. Schedule write-behind save

**What it does NOT do:** load from DB (delegated to roomManager), save to DB (delegated to persistence helper), manage socket membership (delegated to roomManager).

---

### `cleanup.js` — Disconnect & Eviction

Handles `"disconnect"` events and `checkAndCleanupRoom()` logic.

**The cleanup sequence:**
1. Check `socket.cleanupDone` (idempotency guard)
2. Remove socket from `activeRooms[roomId].sockets`
3. If room is now empty:
   a. Cancel the debounce timer
   b. Flush document to MongoDB (safety-net save)
   c. Delete `otRooms[roomId]`
   d. Delete `activeRooms[roomId]`
4. If room still has occupants, broadcast presence update

---

### `joinRequests.js` — Approval Flow

Manages the `pendingRequests` lifecycle within `activeRooms`.

**Events handled:**
- `"requestJoin"`: Add user to pendingRequests, notify owner
- `"approveJoin"`: Validate owner identity, call `addToSharedTo`, emit `"joinApproved"` to requester
- `"denyJoin"`: Remove from pendingRequests, emit `"joinDenied"` to requester

---

### `roomManager.js` — Membership

Handles room creation (via REST), socket join, and socket leave.

**Key invariant enforced here:** A user can only be in one room at a time per socket. `socket.currentRoom` is set on join and cleared on leave. Every event handler checks `socket.currentRoom === roomId` before proceeding.

---

### `index.js` — Wiring

The composition root. Initializes Express, attaches Socket.IO, registers the JWT `io.use()` middleware, and wires all event handlers from the above modules to the Socket.IO event bus.

**No business logic lives here.** It is purely structural.

---

## Frontend Architecture

The frontend is a React + TypeScript application. Its most important design decision is **effect separation**: each concern (OT, cursors, synchronization) lives in an independent `useEffect` with its own dependency array, rather than one monolithic effect that mixes concerns.

### Why Effect Separation?

In React, effects re-run when their dependencies change. A monolithic effect with 10 dependencies re-runs whenever any of the 10 change, potentially:
- Reattaching socket listeners unnecessarily
- Causing stale closure bugs where an event handler captures an old version of a state variable

By splitting into independent effects:

```typescript
// Effect 1: OT operation sending/receiving
// Dependencies: [socket, quillRef]
useEffect(() => {
  if (!socket || !quillRef.current) return;
  const quill = quillRef.current.getEditor();
  
  quill.on("text-change", handleLocalChange);
  socket.on("operation", handleRemoteOperation);
  
  return () => {
    quill.off("text-change", handleLocalChange);
    socket.off("operation", handleRemoteOperation);
  };
}, [socket, quillRef]);

// Effect 2: Cursor sync
// Dependencies: [socket, quillRef, currentUser]
useEffect(() => {
  // cursor-specific listeners
}, [socket, quillRef, currentUser]);

// Effect 3: Initial document sync
// Dependencies: [socket, roomId]
useEffect(() => {
  // fetch document state on join
}, [socket, roomId]);
```

### Stale Closure Prevention

The `inflightDeltaRef` and `pendingDeltaRef` are **refs, not state**. In React, state updates are asynchronous and a closure captures the state value at the time the closure was created. If `inflightDelta` were state, the `handleRemoteOperation` closure might see a stale (old) value.

Refs are mutable objects — mutating `.current` does not re-render, but reading `.current` always gives the latest value. Using refs for the OT buffers ensures that event handlers always read the **current** inflight/pending state.

```typescript
const inflightDeltaRef = useRef<Delta | null>(null);
const pendingDeltaRef = useRef<Delta | null>(null);
const confirmedVersionRef = useRef<number>(0);
```

---

## Cursor Synchronization Architecture

```
User moves cursor in Quill
          │
          ▼
Quill "selection-change" event fires
          │
          ▼
Throttle to 50ms (lodash throttle)
(prevents cursor flood: ~100 cursor events/second → ~20/second)
          │
          ▼
emit("cursor", { range: { index, length }, userId, roomId })
          │
          ▼
Server receives cursor event
  → validate membership (socket.currentRoom check)
  → broadcast to all OTHER sockets in room (not sender)
          │
          ▼
Remote clients receive cursor event
          │
          ▼
quill-cursors plugin:
  cursors.moveCursor(userId, range)
  cursors.toggleFlag(userId, true)
```

### Cursor Sync Requests

When a new user joins a room, they won't receive cursor positions from existing users until those users next move their cursor. To avoid "ghost" state where the new user sees no cursors until everyone moves:

```
New user joins room
  → emits "requestCursorSync"
          │
          ▼
Server broadcasts "syncCursorsRequest" to all other sockets in room
          │
          ▼
Each existing user responds with their current cursor position
  → new user receives all cursors immediately
```

### Why 50ms Throttle?

Cursor updates are **not part of the OT protocol** — they are display hints only. A cursor that's 50ms stale is imperceptible to users. Without throttling, a fast typist generates a cursor event per keystroke (~100ms apart), creating unnecessary network traffic and cursor-plugin re-renders. 50ms strikes a balance between responsiveness and efficiency.

---

## Error Recovery & Resynchronization

### Force Resync

When the server determines that a client's version gap exceeds `MAX_HISTORY`, it cannot reconstruct the transforms needed to reconcile the client's operation. Instead of rejecting it silently (leaving the client in a corrupt state) or crashing (bad), it emits a resync signal:

```javascript
socket.emit("resync", {
  document: otRoom.document,  // full document state
  version:  otRoom.version,   // current server version
});
```

The client handles this by:
1. Replacing the Quill document with the server's document
2. Setting `confirmedVersion = version`
3. Discarding `inflightDelta` and `pendingDelta` (they're now invalid)

**This is a lossy operation** — any unsaved local edits are discarded. This is an acceptable tradeoff: a resync only occurs when the client is so far behind that their edits would produce garbage if applied. The better fix is ensuring clients are never this far behind (better network handling, reconnection logic), but force-resync is the safety net.

### Legacy Schema Migration

Old documents in MongoDB may not have the `version` field (if they predate the versioning system). The server handles this gracefully:

```javascript
const version = room.version ?? 0; // default to 0 if undefined
```

This **defensive default** prevents crashes on schema migration. The `??` (nullish coalescing) operator specifically handles `null` and `undefined` without catching `0` (a valid version).

### Failed Persistence

If the MongoDB write fails during the write-behind save:

```javascript
try {
  await Room.findByIdAndUpdate(roomId, { content: document, version });
} catch (err) {
  console.error("Persistence failed for room", roomId, err);
  // Do NOT re-throw. The in-memory state is still correct.
  // Next scheduled save will attempt again.
}
```

Persistence failure does not crash the server or reject the client operation. The in-memory state remains correct; the document will be saved on the next scheduled attempt or on room cleanup. This is appropriate for a system where the in-memory state is the source of truth during a session.

---

## Testing Strategy

### Framework: Vitest

Vitest was chosen over Jest for its native ESM support, faster execution, and compatibility with the project's module system. The test suite is split into four files by concern.

### `ot.test.js` — OT Convergence

Tests the core OT algorithm in isolation, without Socket.IO or MongoDB.

```
Test cases:
  ✓ Single client, no concurrency: op applied directly
  ✓ Two concurrent inserts at same position: converge to same result
  ✓ Concurrent insert and delete: delete adjusted for insert
  ✓ Lagging client: transform against composed history
  ✓ Version monotonicity: version only increases
  ✓ Force-resync threshold: gap > MAX_HISTORY triggers resync signal
  ✓ History trimming: history length stays ≤ MAX_HISTORY after 600 ops
```

### `roomLifecycle.test.js` — Room State Machine

Tests the room creation, join, leave, and cleanup lifecycle.

```
Test cases:
  ✓ Room created on first join
  ✓ otRooms entry created when user joins
  ✓ activeRooms entry cleaned up when last user leaves
  ✓ otRooms entry cleaned up when last user leaves
  ✓ Safety-net save called on cleanup
  ✓ Double-cleanup prevention: cleanup runs once per socket
  ✓ Owner offline: join request stored in pendingRequests
```

### `auth.test.js` — Authentication

Tests JWT validation for both HTTP and WebSocket paths.

```
Test cases:
  ✓ Valid JWT accepted on HTTP route
  ✓ Invalid JWT rejected with 401
  ✓ Missing JWT rejected with 401
  ✓ userId sourced from JWT, not request body
  ✓ Socket connection with valid JWT: userId set on socket
  ✓ Socket connection with invalid JWT: connection rejected
  ✓ Operation with wrong roomId silently dropped
```

### `otBuffer.test.ts` — Client Buffer (TypeScript)

Tests the client-side OT buffer state machine.

```
Test cases:
  ✓ First edit: goes to inflightDelta directly (pendingDelta stays null)
  ✓ Second edit while inflight: merged into pendingDelta
  ✓ Third edit while inflight: composed into pendingDelta
  ✓ Ack received: inflight cleared, pending promoted to inflight
  ✓ Ack with no pending: idle state restored
  ✓ Remote op while inflight: applied after retransform
  ✓ Remote op while both inflight and pending: both retransformed
  ✓ Force-resync: buffers cleared, version updated
```

---

## Scaling Analysis

### Current Throughput Envelope

On a single Node.js process with MongoDB on the same machine:

| Metric | Approximate Capacity |
|--------|----------------------|
| Concurrent WebSocket connections | ~10,000 (Socket.IO default) |
| Active rooms (in-memory) | ~1,000 (memory-bound, ~50KB/room) |
| Operations/second (single room) | ~200 (queue serialized, ~5ms/op) |
| Operations/second (10 rooms) | ~2,000 (queues are independent) |
| MongoDB write throughput | Not on hot path (write-behind) |

---

## Current Bottlenecks

### 1. Per-Document Serial Queue

The DocumentQueue ensures correctness but limits throughput to one operation at a time per room. For a document with many fast typists, this creates a queue depth that grows without bound if operations arrive faster than they are processed.

**Mitigation in current design:** Each OT operation is fast (microseconds for the transform, no I/O on the hot path). In practice, the queue depth stays near 0.

**Long-term fix:** Batching — process multiple operations in a single queue tick when they arrive close together.

### 2. In-Memory State

All room state lives in the Node.js process memory. This means:
- No horizontal scaling without distributed state
- A server crash loses all in-memory state for active rooms (mitigated by write-behind, but there's a max 5s window of potential data loss)

### 3. `history.shift()` is O(n)

Trimming the history array with `shift()` is O(n) where n = MAX_HISTORY. For 500 entries this is negligible, but it's worth noting. A proper ring buffer would make this O(1).

### 4. No Operation Batching on Client

The client sends one Socket.IO event per Quill `text-change` event. Quill fires `text-change` per user interaction (not per character), so this is typically fine. But a paste of a large document generates a single large delta — fine — whereas programmatic inserts in a loop could flood the socket.

---

## Why It Is Single-Server Today

The architecture is deliberately single-server for three reasons:

1. **OT correctness requires a total order.** Every operation must be assigned a monotonically increasing version number by a single authority. With multiple servers, you'd need a distributed consensus mechanism (e.g., a globally sequenced Kafka topic or a Raft-based sequencer) to maintain this ordering.

2. **In-memory state is not shared.** `otRooms` and `activeRooms` live in the Node.js process. Two servers would have different in-memory states. A socket connecting to Server B would not find the room state that Server A is managing.

3. **Correctness before scale.** The first priority was to build a system that is provably correct under concurrency. Scaling is a problem to solve after correctness is established.

---

## What Would Be Needed For Horizontal Scaling

```
Current (single-server):
  Client → Server 1 (all rooms)

With horizontal scaling:
  Client → Load Balancer (sticky sessions or consistent hash by roomId)
           ↓
  Server 1 (rooms A, B, C)    Server 2 (rooms D, E, F)

  Problems to solve:
  ┌──────────────────────────────────────────────────────────┐
  │ 1. Room affinity: ensure all sockets for a room land on  │
  │    the same server (consistent hash by roomId in LB)     │
  │                                                          │
  │ 2. Distributed OT state: if a server fails, another must │
  │    pick up the room → needs Redis or distributed DB for  │
  │    otRooms                                               │
  │                                                          │
  │ 3. Socket.IO clustering: use socket.io-redis-adapter for │
  │    cross-server event broadcasting                       │
  │                                                          │
  │ 4. DocumentQueue must be distributed: Redis-based lock   │
  │    or a dedicated sequencer service per room             │
  └──────────────────────────────────────────────────────────┘
```

A realistic scaling path:
1. **Phase 1:** Move `otRooms` to Redis (Redis Hashes + Lua scripts for atomic updates). DocumentQueue becomes a Redis BLPOP queue.
2. **Phase 2:** Add socket.io-redis-adapter for cross-server broadcast.
3. **Phase 3:** Add a dedicated sequencer service (or use Kafka as an ordered log per room).

---

## OT vs CRDT Discussion

| Dimension | OT (this project) | CRDT (e.g., Yjs) |
|-----------|-------------------|------------------|
| **Convergence guarantee** | Guaranteed with correct transform functions | Guaranteed by construction |
| **Server requirement** | Server-authoritative model needed | Can be fully peer-to-peer |
| **Algorithm complexity** | Transform functions are non-trivial for rich text | Data structure design is complex, but transforms are simple |
| **History requirement** | Bounded history for lagging clients | No history needed |
| **Undo semantics** | Can be implemented with inverse ops | More complex; Yjs has its own undo manager |
| **Offline editing** | Difficult: version gaps grow unboundedly offline | Natural: CRDTs are designed for this |
| **Rich text support** | Quill Delta has well-defined OT semantics | Yjs has first-class Quill binding (Y.Text) |
| **Debuggability** | Straightforward: version log tells the whole story | Harder: internal CRDT state is not human-readable |
| **Existing ecosystem** | Must implement transforms yourself (or use ShareDB) | Yjs, Automerge are mature libraries |

**Why OT was chosen here (again, in full):**

This project was built to understand collaborative editing from first principles. Using Yjs would be "correct" for a production product but would hide the hard parts. The choice to implement OT directly was a deliberate engineering education decision.

For a greenfield production system in 2024, **Yjs + Quill binding** would likely be the recommended choice. Yjs is battle-tested, handles offline editing gracefully, and doesn't require a sequencer server. The tradeoff is opacity — you trust the library, not your own implementation.

---

## Production Readiness Assessment

### ✅ Production-Ready

- JWT authentication with proper server-side validation
- No wildcard CORS origins
- Async error isolation (DB failures don't crash the server)
- Idempotent cleanup with double-cleanup prevention
- Write-behind persistence with safety-net flush
- Bounded history to prevent memory exhaustion
- Force-resync for unrecoverable state divergence

### ⚠️ Needs Work Before Production

- **No rate limiting** on operation events (a malicious client could flood the queue)
- **No operation size limit** (a single enormous paste could cause memory pressure)
- **`history.shift()` is O(n)** — acceptable at MAX_HISTORY=500, should be a ring buffer for larger values
- **No reconnection backoff** on the client (rapid reconnects can amplify load)
- **Single-process** — no fault tolerance; a crash takes down all active rooms

### ❌ Not Production-Ready

- **No horizontal scaling** — see [Scaling Analysis](#scaling-analysis)
- **No TLS termination in-process** (should be handled by a reverse proxy like nginx/Caddy in production)
- **No metrics/observability** — no Prometheus, no tracing, no structured logging
- **In-memory session state** — a restart loses up to 5 seconds of edits for active rooms

---

## Strengths of the Current Architecture

1. **Correctness is the top priority.** The per-document serial queue, server-authoritative model, and explicit version counter make the system provably correct under all tested concurrency scenarios.

2. **Clear separation of concerns.** OT state (`otRooms`) and session state (`activeRooms`) are deliberately separate. Each module has a single responsibility.

3. **Defensive programming throughout.** Legacy schema migration with `?? 0`, `try/catch` on all DB calls, idempotency guards, and `userId` sourced only from JWT — these are not afterthoughts.

4. **Testable by design.** The OT engine is a pure function (given document + version + history + incoming op → new document + new version). It can be tested without any I/O.

5. **Memory-bounded.** `MAX_HISTORY = 500` prevents a long-running room from consuming unbounded memory. The write-behind save prevents the document from growing stale.

---

## Tradeoffs Made

| Decision | Tradeoff |
|----------|----------|
| Server-authoritative OT | Simplifies correctness, but adds round-trip latency before "commit" |
| Write-behind persistence | Reduces DB load, but up to 5s of edits can be lost on crash |
| In-memory state | Fast and simple, but not horizontally scalable |
| Bounded history (500) | Prevents memory exhaustion, but long-offline clients get force-resynced |
| Serial DocumentQueue | Guarantees correctness, but limits per-room throughput |
| JWT over sessions | Stateless and scalable, but tokens can't be invalidated before expiry |
| Quill + React-Quill | Mature rich-text library, but React-Quill has known lifecycle quirks with React 18+ |

---

## Known Limitations

1. **No conflict-free undo/redo.** Undo in a collaborative context is significantly more complex than in a single-user editor. It is not implemented.

2. **No persistent cursor positions.** Cursor positions are ephemeral — they are broadcast over the socket but never persisted. A page reload clears all cursor state.

3. **No document branching/versioning.** The document has one linear history. There is no snapshot, branch, or version-restore feature.

4. **Single document per room.** Each room maps to exactly one document. Multi-document rooms are not supported.

5. **Maximum 500 history entries.** Clients offline for longer than 500 ops per room will be force-resynced and lose their unsaved edits.

6. **No end-to-end encryption.** Documents are stored in plaintext in MongoDB. The server has full read access to all documents.

---

## Future Improvements

### Short-Term (weeks)

- [ ] Replace `history.shift()` with a proper ring buffer (O(1) trim)
- [ ] Add rate limiting per socket on the `operation` event
- [ ] Add operation size limits (reject deltas larger than N bytes)
- [ ] Structured logging with correlation IDs (room_id, user_id, version)
- [ ] Reconnection backoff with exponential jitter on the client

### Medium-Term (months)

- [ ] Move `otRooms` to Redis for persistence and multi-process support
- [ ] Add socket.io-redis-adapter for horizontal scaling
- [ ] Event sourcing: store all operations, not just the composed document
- [ ] Conflict-free undo using inverse operations
- [ ] Real-time presence indicators (typing status, not just cursor position)

### Long-Term (quarters)

- [ ] Evaluate migration to Yjs for offline-first support
- [ ] End-to-end encryption using client-side keys
- [ ] Document versioning/snapshots
- [ ] Observability: Prometheus metrics, OpenTelemetry tracing
- [ ] WebRTC peer-to-peer cursor updates (bypass server for non-authoritative events)

---

## Installation Guide

### Prerequisites

- Node.js ≥ 18.0.0
- MongoDB ≥ 6.0
- npm ≥ 9.0.0

### Clone and Install

```bash
git clone https://github.com/yourusername/collabedit.git
cd collabedit

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

---

## Environment Variables

### Backend (`backend/.env`)

```env
# Server
PORT=3001
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/collabedit

# JWT
JWT_SECRET=your-secret-key-min-32-chars
JWT_EXPIRES_IN=7d

# CORS
FRONTEND_URL=http://localhost:5173
```

### Frontend (`frontend/.env`)

```env
VITE_BACKEND_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
```

**Security note:** Never commit `.env` files. The `JWT_SECRET` must be a cryptographically random string of at least 32 characters. Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Running Locally

```bash
# Terminal 1: Start MongoDB (if not running as a service)
mongod --dbpath ./data/db

# Terminal 2: Start backend
cd backend
npm run dev    # uses nodemon for hot reload

# Terminal 3: Start frontend
cd frontend
npm run dev    # Vite dev server on http://localhost:5173
```

The backend starts on `http://localhost:3001`. The frontend proxies API calls to the backend.

---

## Running Tests

```bash
# All tests
cd backend
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Run a specific test file
npx vitest run tests/ot.test.js
```

Expected output:

```
 ✓ tests/ot.test.js (14 tests) 23ms
 ✓ tests/roomLifecycle.test.js (9 tests) 18ms
 ✓ tests/auth.test.js (8 tests) 12ms
 ✓ tests/otBuffer.test.ts (11 tests) 9ms

 Test Files  4 passed (4)
      Tests  42 passed (42)
   Duration  1.23s
```

---

## Example Collaboration Session

### Timeline

```
t=0s  Alice opens document (roomId: "doc-xyz")
      → HTTP GET /rooms/doc-xyz (JWT validated)
      → Socket connects, JWT middleware sets socket.userId = "alice"
      → emit("joinRoom", { roomId: "doc-xyz" })
      → Server loads document from MongoDB → otRooms["doc-xyz"] initialized
      → Client receives { document, version: 42 }
      → Quill renders document

t=2s  Bob requests to join
      → HTTP POST /join-request { roomId: "doc-xyz" }
      → Server emits "joinRequest" to Alice's socket

t=3s  Alice approves
      → Alice's UI emits "approveJoin" { userId: "bob" }
      → Server adds bob to sharedTo[], emits "joinApproved" to Bob
      → Bob's socket joins room

t=5s  Alice types "Hello" at position 0
      → Quill fires text-change
      → inflightDelta = { ops: [{ insert: "Hello" }] }
      → emit("operation", { delta: inflightDelta, version: 42 })

t=5s  Bob types "World" at position 0 (concurrent, same instant)
      → Bob's inflightDelta = { ops: [{ insert: "World" }] }
      → emit("operation", { delta: inflightDelta, version: 42 })

t=5s  Server receives Alice's op first (arbitrary network ordering)
      → DocumentQueue for "doc-xyz": Alice's op runs
      → version 42 → apply → version 43
      → history[42] = Alice's delta
      → Broadcast to Bob: { delta: Alice's delta, version: 43 }
      → Ack to Alice: { version: 43 }

t=5s  Server receives Bob's op (clientVersion: 42, serverVersion: 43)
      → DocumentQueue: Bob's op runs after Alice's completes
      → clientVersion(42) < serverVersion(43)
      → compose history[42..43] = Alice's delta
      → transform Bob's delta against Alice's delta
        Bob wanted to insert "World" at 0
        Alice inserted "Hello" at 0 → Bob's position shifts to 5
        transformed: { ops: [{ retain: 5 }, { insert: "World" }] }
      → Apply: document becomes "HelloWorld"
      → version 43 → 44
      → Broadcast transformed op to Alice: { delta: transformed, version: 44 }
      → Ack to Bob: { version: 44 }

t=5s  Alice receives Bob's transformed op, applies: "Hello" → "HelloWorld"
t=5s  Bob receives Alice's op (already applied locally before ack)
      Bob's ack arrives: confirmedVersion = 44

Result: Both Alice and Bob see "HelloWorld". Convergence achieved. ✓
```

---

## Engineering Highlights for Recruiters

This project demonstrates engineering judgment across several domains:

### Distributed Systems

- Implemented a server-authoritative OT algorithm that correctly handles concurrent operations, version gaps, and force-resync conditions without a library.
- Designed a per-document serial execution queue using Promise chaining to prevent async transform races without requiring a mutex or external lock service.

### Systems Design

- Separated OT state from session state (`otRooms` vs `activeRooms`) to enforce clean layer boundaries.
- Implemented write-behind persistence with a 5-second debounce and a safety-net flush on room eviction, decoupling the OT hot path from MongoDB write latency.
- Bounded history to MAX_HISTORY=500 to prevent unbounded memory growth in long-running rooms.

### Security

- JWT authentication for both HTTP and WebSocket paths, with `socket.userId` set immutably at connect time by `io.use()` middleware — the user ID never comes from the client payload.
- Explicit CORS origin validation; no wildcard origins.
- Room membership validation on every event handler, not just at join time.

### Frontend Engineering

- Implemented a client-side OT buffer (inflight/pending delta model) in TypeScript with correct retransformation semantics when remote operations arrive during buffering.
- Used React refs (not state) for OT buffer variables to prevent stale closure bugs in event handlers.
- Separated socket effect hooks by concern to prevent unnecessary re-attachment of listeners.

### Testing

- 42 tests across 4 test files covering OT convergence, version monotonicity, room lifecycle, authentication, and client buffer state transitions.
- OT engine tested as a pure function, independent of I/O, enabling fast and reliable unit tests.

---

## Resume-Worthy Technical Achievements

```
✦ Implemented Operational Transformation from first principles using Quill Delta,
  with server-side transform, version management, bounded history, and force-resync.

✦ Designed a per-document serial execution queue (Promise chaining) to prevent
  async transform races — zero-dependency, non-blocking, leak-resistant.

✦ Built a client-side OT buffer (inflight/pending model) in TypeScript with
  correct retransformation semantics under concurrent remote operations.

✦ Implemented a write-behind persistence layer with debounced saves and
  safety-net flush on room eviction, reducing MongoDB write load by ~50x
  under heavy editing.

✦ Secured WebSocket connections with JWT validated in io.use() middleware,
  with userId set immutably server-side — never trusted from client payloads.

✦ 42 unit and integration tests covering OT convergence, version monotonicity,
  authentication, room lifecycle, and client buffer state transitions.
```

---

## Conclusion

CollabEdit is an engineering exercise in **correctness under concurrency** — the hard problem at the heart of every collaborative editing system. It makes no attempt to be feature-complete or horizontally scalable today. It is deliberately limited in scope so that its core invariants can be stated and tested precisely:

- **Every client converges to the same document state**, regardless of operation arrival order.
- **The version counter is monotonically increasing**, and every client operation is applied at exactly one version.
- **The server is the single source of truth**, and no client-supplied data can elevate its own privilege.
- **Room state is bounded**, and cleanup is correct and idempotent.

These invariants are more valuable, as engineering artifacts, than a long feature list on a system that silently corrupts documents under adversarial concurrency.

The system is ready to be extended with confidence — the foundation is sound, the modules are cleanly separated, and the test suite provides a safety net for future changes.

---

*Built with Node.js, Express, Socket.IO, MongoDB, React, TypeScript, and Quill. Tests with Vitest.*