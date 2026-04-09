---
name: "Feature Flag System"
version: "1.0.0"
description: "Implements feature flags for progressive rollouts, A/B testing, and kill switches. Supports user targeting and percentage rollouts."
author: "workspace"
activated: false
---

# Feature Flag System

Implements feature flags for progressive rollouts, A/B testing, and kill switches. Supports user targeting and percentage rollouts.

## Decision Framework

### When to Apply
Use when: Progressive rollouts, A/B testing, kill switches, environment-specific features, beta programs

### When NOT to Apply
Don't use when: Feature is permanent and always-on, simple config values suffice

## Anti-Patterns

### 1. Flags That Never Get Removed
Technical debt accumulates. Schedule flag cleanup after full rollout.

### 2. Complex Flag Dependencies
```javascript
// BAD: Hard to reason about
if (flags.newCheckout && flags.newPayment && !flags.legacyCart) { }

// GOOD: Single flag with clear meaning
if (flags.modernCheckoutFlow) { }
```


## Trigger Phrases

- "Feature flags"
- "A/B testing"
- "Progressive rollout"
- "Kill switch"
- "Feature toggle"

## Patterns

### Flag Evaluator
```javascript
class FeatureFlags {
  constructor(flags) { this.flags = flags; }

  isEnabled(flagName, context = {}) {
    const flag = this.flags[flagName];
    if (!flag || !flag.enabled) return false;

    // Percentage rollout
    if (flag.percentage < 100) {
      const hash = this.hashUserId(context.userId || 'anonymous');
      if (hash % 100 >= flag.percentage) return false;
    }

    // User targeting
    if (flag.targetUsers?.includes(context.userId)) return true;

    // Environment
    if (flag.environments && !flag.environments.includes(context.env)) return false;

    return true;
  }

  hashUserId(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}
```

## Integration
- Works with: deployment-pipeline-architect, multi-tenant-architecture, notification-system-builder

