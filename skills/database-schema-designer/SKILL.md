---
name: "Database Schema Designer"
version: "1.0.0"
description: "Designs normalized, performant database schemas with proper indexing, constraints, and migration strategies. Supports PostgreSQL, MySQL, and SQLite."
author: "workspace"
activated: false
---

# Database Schema Designer

Designs normalized, performant database schemas with proper indexing, constraints, and migration strategies. Supports PostgreSQL, MySQL, and SQLite.

## Decision Framework

### When to Apply
Use when: New database design, schema migrations, performance optimization, relationship modeling

### When NOT to Apply
Don't use when: Simple key-value stores, pure document DB design

## Anti-Patterns

### 1. No Indexes on Foreign Keys
```sql
-- BAD: No index on foreign key
CREATE TABLE orders (id SERIAL, user_id INT REFERENCES users(id));

-- GOOD: Indexed foreign key
CREATE TABLE orders (id SERIAL, user_id INT REFERENCES users(id));
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

### 2. Storing JSON Blobs in SQL
```sql
-- BAD: Unqueryable JSON dump
CREATE TABLE users (id SERIAL, data JSONB);

-- GOOD: Indexed JSONB with GIN index
CREATE TABLE users (id SERIAL, profile JSONB);
CREATE INDEX idx_users_profile ON users USING GIN (profile);
```

### 3. No Migrations
Applying schema changes manually leads to drift between environments.


## Trigger Phrases

- "Design database"
- "Schema design"
- "Table structure"
- "Database migration"
- "Index optimization"
- "Relationship modeling"

## Patterns

### Migration System
```javascript
class MigrationRunner {
  async run(migrations) {
    const applied = await this.getAppliedMigrations();
    for (const migration of migrations) {
      if (!applied.includes(migration.id)) {
        await this.db.transaction(async (trx) => {
          await migration.up(trx);
          await trx('migrations').insert({ id: migration.id, applied_at: new Date() });
        });
      }
    }
  }
}
```

### Indexing Strategy
| Query Pattern | Index Type |
|---|---|
| Exact match | B-tree |
| Range queries | B-tree |
| Full text search | GIN / Full-text |
| Array contains | GIN |
| Geospatial | GiST |

## Integration
- Works with: data-migration-orchestrator, multi-tenant-architecture

