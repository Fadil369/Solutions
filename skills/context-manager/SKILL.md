---
name: "Context Manager"
version: "1.0.0"
description: "Manages conversation context, skill state, and system knowledge across sessions. Handles persistence, transformation, and retrieval of contextual data."
author: "workspace"
activated: false
---

# Context Manager

## Overview

Manages conversation context, skill state, and system knowledge across sessions. Handles persistence, transformation, and retrieval of contextual data.

## Capabilities

### Context Tracking
- Monitors active skills and their current state
- Tracks file edits, tool usage, and project changes
- Maintains session history and decisions made

### State Management
- Manages skill activation/deactivation
- Persists context across conversation turns
- Provides context summaries for long conversations

### Knowledge Graph
- Builds relationships between skills, files, and concepts
- Suggests relevant skills based on current context
- Tracks skill usage patterns and effectiveness

## Trigger Phrases

- "What context do we have?"
- "Summarize what we've done"
- "What skills have been used?"
- "Show session state"
- "What files were changed?"

## Workflow

1. **Monitor** - Track all skill activations and file changes
2. **Analyze** - Build context graph of related activities
3. **Summarize** - Provide concise context summaries
4. **Suggest** - Recommend relevant skills for current task
5. **Persist** - Save important context for future reference

## Context Schema

```json
{
  "session_id": "string",
  "active_skills": [],
  "file_changes": [],
  "decisions_made": [],
  "pending_tasks": [],
  "context_graph": {}
}
```

## Integration Points

- Works with all other skills to track usage
- Integrates with file system for change detection
- Provides context to session startup routines
