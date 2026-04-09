---
name: "Multi-Tenant Architecture"
version: "1.0.0"
description: "Designs multi-tenant systems with data isolation, tenant-aware routing, and resource quotas."
author: "workspace"
activated: false
---

# Multi-Tenant Architecture

Designs multi-tenant systems with data isolation, tenant-aware routing, and resource quotas.

## Decision Framework

### When to Apply
Use when: SaaS applications, white-label solutions, enterprise with divisions, B2B platforms

### When NOT to Apply
Don't use when: Single-tenant app, personal projects, consumer apps

## Anti-Patterns

### 1. No Tenant Isolation
```javascript
// BAD: Any user can access any tenant's data
const orders = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);

// GOOD: Always scope by tenant
const orders = await db.query('SELECT * FROM orders WHERE id = ? AND tenant_id = ?', [orderId, tenantId]);
```

### 2. Shared Sessions Across Tenants
Always scope sessions and caches by tenant ID.


## Trigger Phrases

- "Multi-tenant"
- "Tenant isolation"
- "SaaS architecture"
- "White-label"
- "Data segregation"

## Patterns

### Tenant Resolution Middleware
```javascript
const tenantMiddleware = async (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'] || extractSubdomain(req.hostname);
  if (!tenantId) return res.status(400).json({ error: 'Tenant not specified' });
  
  const tenant = await tenantService.get(tenantId);
  if (!tenant || tenant.status !== 'active') return res.status(404).json({ error: 'Tenant not found' });
  
  req.tenant = tenant;
  req.db = getTenantConnection(tenant.id);
  next();
};
```

### Isolation Models
| Model | Isolation | Cost | Complexity |
|---|---|---|---|
| Shared DB + tenant_id | Low | Low | Low |
| Schema per tenant | Medium | Medium | Medium |
| Database per tenant | High | High | High |

## Integration
- Works with: database-schema-designer, authentication-flow-designer, feature-flag-system

