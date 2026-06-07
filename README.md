# CollabEdit — Production-Grade Collaborative Real-Time Editor

> A server-authoritative, OT-based collaborative text editor engineered for correctness under concurrency, not just for demo conditions.

CollabEdit is a **real-time collaborative rich-text editor** built from first principles, without relying on off-the-shelf CRDT or OT libraries for its core convergence logic. It implements a **server-authoritative Operational Transformation** model on top of Socket.IO, with a carefully designed client-side delta buffer, a monotonic version counter, per-document serial execution queues, and a bounded history store — all choices deliberately made to solve the hard problem of collaborative editing: **making concurrent, causally-unordered edits converge to the same document state on all clients.**

This is not a tutorial project. It is an engineering exercise in distributed systems correctness, demonstrating a deep understanding of the same fundamental challenges that Google Docs, Notion, and Figma had to solve at scale.

---

## Table of Contents

1. [File Structure](#file-structure)
2. [High-Level Overview](#high-level-overview)
3. [Key Features](#key-features)
4. [Architecture Overview](#architecture-overview)
5. [End-to-End Request Flow](#end-to-end-request-flow)
6. [Operational Transformation Deep Dive](#operational-transformation-deep-dive)
7. [How Versioning Works](#how-versioning-works)
8. [Versioning](#versioning)
9. [Client Buffering Strategy](#client-buffering-strategy)
10. [Concurrency Control Strategy](#concurrency-control-strategy)
11. [Persistence Strategy](#persistence-strategy)
12. [Room Lifecycle Management](#room-lifecycle-management)
13. [ActiveRooms Data Structure](#activerooms-data-structure)
14. [OTRooms Data Structure](#otrooms-data-structure)
15. [Join Approval Workflow](#join-approval-workflow)
16. [Authentication & Security Design](#authentication--security-design)
17. [Frontend Architecture](#frontend-architecture)
18. [Testing Strategy](#testing-strategy)
19. [OT vs CRDT Discussion](#ot-vs-crdt-discussion)
20. [Installation Guide](#installation-guide)
21. [Environment Variables](#environment-variables)
22. [Running Tests](#running-tests)

---

## File Structure

```
.
├── Backend/
│   ├── .env                      # Local environment configurations
│   ├── app.js                    # Entry point: Express, Socket.IO wiring
│   ├── controllers/
│   │   ├── AuthController.js     # User registration and authentication handlers
│   │   └── DocumentController.js # Document CRUD and transform operations handlers
│   ├── middlewares/
│   │   ├── AuthMiddleware.js     # JWT HTTP verification middleware
│   │   ├── RequireAuth.js        # Authorization middleware
│   │   └── SocketAuthMiddleware.js # Connection authentication middleware for Socket.IO
│   ├── models/
│   │   ├── Document.js           # Mongoose schema for document content and version
│   │   ├── UserModel.js          # Mongoose schema for user details
│   │   └── UserSetting.js        # Mongoose schema for user settings
│   ├── routes/
│   │   ├── AuthRoute.js          # REST routes for user auth
│   │   └── DocumentRoute.js      # REST routes for document management
│   ├── socket/
│   │   ├── cleanup.js            # Disconnect handling and room eviction
│   │   ├── collaboration.js      # OT engine: delta processing, transforming, history log
│   │   ├── index.js              # Socket connections and registration of handlers
│   │   ├── joinRequests.js       # Join request approval workflow logic
│   │   ├── roomManager.js        # Room creation and membership check logic
│   │   └── state.js              # Shared in-memory active rooms and OT rooms
│   └── tests/
│       ├── auth.test.js          # Route authorization and security tests
│       ├── ot.test.js            # In-memory OT convergence and history tests
│       └── roomLifecycle.test.js # Room setup, teardown, and eviction tests
│
├── Collab Write (frontend)/
│   ├── .env                      # Local frontend configurations
│   ├── index.html                # App entry HTML template
│   ├── package.json              # Frontend dependency manifest
│   ├── public/                   # Public assets
│   ├── src/
│   │   ├── App.tsx               # Client router and base component
│   │   ├── Components/
│   │   ├── Context/
│   │   ├── Pages/
│   │   ├── tests/
│   │   └── util/
│   │       └── otBuffer.ts       # Client-side buffer manager class (inflight, pending)
│   └── vite.config.ts            # Vite bundle configuration
│
├── LICENSE                       # Project software license
├── README.md                     # Project documentation
├── Security and Scalability considerations.md # Security analysis document
└── package.json                  # Root level package directory setup
```

---

## High-Level Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                            CollabEdit System                           │
│                                                                        │
│  ┌─────────────┐    WebSocket   ┌──────────────────────────────────┐   │
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
│                                 │    │       MongoDB            │  │   │
│                                 │    │  (Mongoose / persistent) │  │   │
│                                 │    └──────────────────────────┘  │   │
│                                 └──────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

The system is designed around a **hub-and-spoke model**: the server is the single source of truth. Every edit passes through the server, gets assigned a canonical version number, is transformed against all concurrent operations the client hasn't seen, and is rebroadcast to other clients. The client never decides what the document looks like — only the server does.

---

## Key Features

| Feature | Description |
|---|---|
| **Rich Text Editing** | Full Quill editor with formatting toolbar, image support, and image resize |
| **Real-Time Collaboration** | Multiple users editing the same document simultaneously |
| **OT Convergence** | Server-authoritative operational transformation ensuring all clients converge |
| **Live Cursors** | Remote user cursors rendered in the editor with presence labels |
| **Room Ownership** | Documents have owners; access requires explicit approval |
| **Join Approval Workflow** | Pending join requests that an owner must accept |
| **Write-Behind Persistence** | Debounced async save — responsive writes without blocking the OT path |
| **Force Resync** | Automatic full-state resynchronization when version gap is unrecoverable |
| **Bounded History** | Operation history capped at 500 ops to prevent unbounded memory growth |
| **Per-Document Serial Queue** | No concurrent OT execution for the same document |

---

## Architecture Overview

The architecture can be decomposed into five horizontal layers:

```
┌─────────────────────────────────────────────────────┐
│                   Transport Layer                   │
│          Socket.IO (WS) + Express (HTTP/REST)       │
├─────────────────────────────────────────────────────┤
│                  Auth/Identity Layer                │
│         JWT middleware (HTTP + io.use() WS)         │
├─────────────────────────────────────────────────────┤
│              Collaboration Protocol Layer           │
│   Room Lifecycle · Join Approval · Presence         │
├─────────────────────────────────────────────────────┤
│                 OT Engine Layer                     │
│   DocumentQueue · Transform · Version Counter       │
├─────────────────────────────────────────────────────┤
│              Persistence Layer (Async)              │
│       Write-Behind Save · MongoDB · Mongoose        │
└─────────────────────────────────────────────────────┘
```

---

## End-to-End Request Flow

### WebSocket Operation (the main collaboration path)

```
User Edit
   │
   ▼
Quill Delta Generated
   │
   ▼
Socket.IO → Server
   │
   ▼
Document Queue
   │
   ▼
Version Check
   │
   ├─ Match → Apply
   │
   └─ Mismatch → Transform Against History
   │
   ▼
Version++
   │
   ├─ Ack Sender
   ├─ Broadcast Delta
   └─ Schedule Save
```

---

## Operational Transformation Deep Dive

Operational Transformation (OT) is a correctness protocol for concurrent editing. It answers the question: **if two users make edits at the same time and I apply them in different orders, do I end up with the same document?**

### The Problem OT Solves

Two users edit `"AC"` at the same time:

- A inserts `"B"` → `"ABC"`
- B inserts `"D"` at the same position

Without OT, the result depends on arrival order and may be incorrect. OT transforms concurrent edits before applying them, preserving user intent and ensuring all clients converge to the same final document.

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

The transform function uses **Quill Delta's** `compose` and `transform` methods. Quill Delta is a well-specified, composable format for rich text operations, which makes the transform semantics well-defined and testable. The `transform` method of Quill Delta comes in handy for preventing us from performing the innumerable amount of cases and mathematical operations that may / may not occur in Operational Transformations.

### Why Server-Authoritative?

A server-authoritative model means the server is the single sequencer. Every operation is linearized through the server before being applied to the canonical document. This avoids the **diamond problem** in peer-to-peer OT, where two clients must independently transform against each other's operations, a significantly harder problem requiring complex causality tracking (vector clocks, etc.).

### Transform Walkthrough (Concrete Example)

Abstract descriptions of OT are easy to find, but this is what actually happens in the code under concurrency:

1. **Server State at $V=5$**: `"AXBC"`
   - `history[4] = { retain: 1, insert: "X" }` (the operation that produced $V=5$, inserting `"X"` after `"A"`)

2. **Client Sends Operation at clientVersion $4$**:
   - `clientDelta = { retain: 2, insert: "Y" }` (wants to insert `"Y"` after `"B"`, intending to produce `"AXBYC"`)
   - *Problem*: The server is already at $V=5$. The client has not yet seen the concurrent `"X"` insertion.

3. **Server Composes History from clientVersion $4$ to serverVersion $5$**:
   - `concurrentDelta = { retain: 1, insert: "X" }`

4. **Server Transforms clientDelta Against concurrentDelta**:
   - Since `"X"` was inserted at position 1 (before the client's target position 2), the client's retain shift is adjusted from 2 to 3.
   - `transformedDelta = { retain: 3, insert: "Y" }`

5. **Apply transformedDelta to the current Document `"AXBC"`**:
   - `"AXBC"` transformed with `{ retain: 3, insert: "Y" }` produces `"AXBYC"`.
   - **Result**: `"Y"` lands after `"B"`, exactly where the user intended.

Without the transform, applying `{ retain: 2, insert: "Y" }` directly to `"AXBC"` would produce `"AXYBC"` (inserting `"Y"` after `"X"`, not `"B"`), violating the user's intent. This is precisely the bug OT convergence logic exists to prevent.

---

## How Versioning Works

## Versioning

Each room maintains a monotonically increasing version counter.

```text
v0 ──opA──► v1
v1 ──opB──► v2
v2 ──opC──► v3
```

When a client sends an operation, it includes its current version. If the client is behind, the server transforms the operation against missed history before applying it. Every accepted operation increments the room version.

Properties
1. Monotonic — versions only increase.
2. Globally ordered — every operation receives exactly one version.
3. Client-visible — clients send their last confirmed version with each operation.
4. History-backed — missed operations can be reconstructed and transformed against recent history.

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

To support optimistic editing, the client maintains:

```typescript
confirmedVersion
inflightDelta
pendingDelta
```

- **inflightDelta**: sent to the server, awaiting acknowledgment.
- **pendingDelta**: local edits buffered while an operation is in flight.
- **confirmedVersion**: latest server-confirmed version.

Remote operations are transformed against buffered edits before being applied, preserving convergence during concurrent editing.

---

## Concurrency Control Strategy

### The DocumentQueue

Without per-document serialization, two operations arriving near-simultaneously could both read version `5`, both compute version `6`, and one would silently overwrite the other. This results in document corruption without any error being raised.

To prevent this concurrency race, the server implements a per-document Promise chain:

```javascript
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

Every OT operation for a given room is appended to that room's chain. Each operation waits for the previous one to fully resolve before executing. 

Key properties:
- **Per-Document Isolation**: The queue is per-document only. Operations on `room2` run in parallel with `room1` operations, ensuring there is no global performance bottleneck.
- **In-Process vs. Mutex**: A mutex (such as a Redis-based distributed lock) solves the same problem but requires an external service and adds acquire/release network latency on every operation. This Promise chain is completely in-process.
- **Non-Blocking & Self-Healing**: The event loop is never stalled. If an operation throws an error, the `.catch` block prevents the chain from freezing, allowing the next operation to run successfully.

---

## Persistence Strategy

### Why Write-Behind?

To avoid blocking collaboration on database writes, document updates are persisted asynchronously.

```text
Edit
 │
 ▼
OT Apply
 │
 ▼
Ack + Broadcast
 │
 ▼
Debounced Save (5s)
 │
 ▼
MongoDB
```

This keeps the OT path fast while significantly reducing database write frequency during active editing sessions.

For 2 people typing a same document at 35wpm or basically 350 characters per second, tha number of API calls reduces to 12 API calls/min for 1 minute instead of 350 API calls/min which is approximately a 96.6% reduction on API calls.

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


### HTTP Routes

```
Express route handler
  → jwtMiddleware (verify token, attach req.userId)
  → route handler (uses req.userId, never req.body.userId)
```

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

---

## Frontend Architecture

The frontend is a React + TypeScript application. Its most important design decision is **effect separation**: each concern (OT, cursors, synchronization) lives in an independent `useEffect` with its own dependency array, rather than one monolithic effect that mixes concerns.


---

## Testing Strategy

### Framework: Vitest

Vitest was chosen over Jest for its ESM support, speed, and compatibility. The test suite covers four areas of concern:

- **OT Convergence (`ot.test.js`)**: Tests convergence, transformations, versioning, history bounds, and ring buffer trims.
- **Room Lifecycle (`roomLifecycle.test.js`)**: Tests room creation, membership updates, safety-net saves, and owner offline scenarios.
- **Authentication (`auth.test.js`)**: Tests JWT token authorization across HTTP endpoints and WebSocket connection setup.
- **Client Buffer (`otBuffer.test.ts`)**: Tests the client-side buffer state machine and optimistic updates under concurrency.

---

## OT vs CRDT Discussion

A natural question in modern collaborative editing is: **why implement Operational Transformation (OT) at all when CRDTs (like Yjs) exist?**

| Dimension | OT (This Project) | CRDT (e.g., Yjs) |
| :--- | :--- | :--- |
| **Convergence Guarantee** | Correct with correct transform functions | Guaranteed by construction |
| **Server Requirements** | Requires a central sequencer | Can be fully peer-to-peer |
| **Offline Editing** | Difficult (version gaps grow unboundedly) | Natural (designed for offline-first) |
| **Rich Text Support** | Quill Delta has well-defined OT semantics | Yjs has a first-class Quill binding |
| **Debuggability** | High (version log tells the whole story) | Low (internal CRDT state is not human-readable) |
| **Transparency** | Must implement transforms yourself | Library is a black box |

Yjs is generally the right call for a greenfield production system today. It handles offline editing gracefully, has a mature Quill binding, and doesn't require a central sequencer. 

However, OT was chosen for this project precisely because Yjs is a black box. This project exists to understand collaborative editing from first principles, and using a pre-built library would defeat that educational purpose entirely.

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
PORT=3000

# MongoDB
MONGODB_URI='your mongodb connection key'

# JWT
TOKEN_KEY=your-secret-key-min-32-chars

# CORS
FRONTEND_URL=http://localhost:5173
```

### Frontend (`frontend/.env`)

```env
VITE_BACKEND_URL=http://localhost:3000
```

---

## Running Tests

```bash
# All tests
npx vitest

# Run a specific test file (within a folder)
npx vitest tests/ot.test.js
```

---