---
name: "Real-Time Collaboration Engine"
version: "1.0.0"
description: "Enables real-time collaborative features with presence, live updates, and shared state."
author: "workspace"
activated: false
---

# Real-Time Collaboration Engine

## Overview

Enables multiple users to collaborate in real-time on shared content with presence awareness and conflict-free updates.

## Decision Framework

### When to use
- Multiple users editing same content
- Live presence indicators needed
- Real-time data synchronization required

### When NOT to use
- Single-user applications
- Batch processing workflows

## Trigger Phrases

- "Real-time updates"
- "Live collaboration"
- "Show who's online"
- "Multiple users editing"
- "WebSocket connection"

## Technology Options

| Technology | Best For | Complexity | Scale |
|-----------|----------|------------|-------|
| WebSockets | Custom solutions | High | Medium |
| Socket.io | Node.js apps | Medium | Medium |
| Pusher/Ably | Managed service | Low | High |
| WebRTC | P2P, video | Very High | Low |
| SSE | Server→Client only | Low | High |

## Presence System

```javascript
class PresenceManager {
  constructor(channel) {
    this.channel = channel;
    this.users = new Map();
  }

  async join(userId, metadata) {
    this.users.set(userId, {
      ...metadata,
      joinedAt: Date.now(),
      lastSeen: Date.now()
    });
    await this.channel.broadcast('user:joined', { userId, metadata });
  }

  async updateCursor(userId, position) {
    await this.channel.broadcast('cursor:moved', { userId, position });
    this.users.get(userId).lastSeen = Date.now();
  }

  async leave(userId) {
    this.users.delete(userId);
    await this.channel.broadcast('user:left', { userId });
  }

  getActiveUsers() {
    const now = Date.now();
    return Array.from(this.users.entries())
      .filter(([_, u]) => now - u.lastSeen < 30000);
  }
}
```

## Conflict Resolution

### Operational Transform
```javascript
class OTEngine {
  constructor() {
    this.document = '';
    this.revision = 0;
    this.buffer = [];
  }

  apply(operation) {
    // Transform against concurrent operations
    let transformed = operation;
    for (const concurrent of this.buffer) {
      transformed = this.transform(transformed, concurrent);
    }
    this.document = this.execute(transformed);
    this.revision++;
    return transformed;
  }

  transform(op1, op2) {
    // Transform op1 against op2
    if (op1.position <= op2.position) {
      return op1;
    }
    return { ...op1, position: op1.position + op2.length };
  }
}
```

## Connection States

```
CONNECTING → CONNECTED → DISCONNECTED
     ↓           ↓            ↓
   [retry]    [active]    [reconnect]
     ↓           ↓            ↓
   CONNECTED  SYNCING    CONNECTED
```

## Error Classification

| Error Type | Severity | Recovery |
|-----------|----------|----------|
| Connection lost | Warning | Auto-reconnect |
| Conflict detected | Info | OT/CRDT merge |
| Auth expired | Error | Re-authenticate |
| Server error | Critical | Fallback to local |
