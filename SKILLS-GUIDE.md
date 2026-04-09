# 📚 Skills Guide

Complete reference for the 26-skill architecture system.

## Architecture Overview

```
workspace/
├── skills/                    # 26 skill modules
│   ├── index.json            # Auto-generated skill index
│   ├── {skill-name}/
│   │   ├── SKILL.md          # Decision framework + patterns
│   │   └── templates/        # Code templates (optional)
├── scripts/
│   └── manage-skills.py      # CLI tool for skill management
├── test/
│   ├── test.py               # Quick validation (5 tests)
│   ├── test-comprehensive.py # Full suite (80+ assertions)
│   └── test-errors.py        # Error recovery validation
└── SKILLS-GUIDE.md           # This file
```

## Skill Categories (26 Total)

| Category | Skills | Count |
|----------|--------|-------|
| **Security & Auth** | authentication-flow-designer | 1 |
| **API & Integration** | api-integration-layer | 1 |
| **Database & Data** | database-schema-designer, data-migration-orchestrator | 2 |
| **Architecture** | component-lifecycle-manager, multi-tenant-architecture, state-machine-designer | 3 |
| **DevOps & Infra** | deployment-pipeline-architect, feature-flag-system | 2 |
| **Accessibility** | accessibility-pattern-library | 1 |
| **Mobile & Touch** | mobile-gesture-handler | 1 |
| **File Handling** | file-upload-orchestrator | 1 |
| **Communication** | notification-system-builder | 1 |
| **Search & Discovery** | search-experience-designer | 1 |
| **Automation** | workflow-automation-designer | 1 |
| **UI Patterns** | form-pattern-engine | 1 |
| **Analytics & Dashboards** | dashboard-composition-engine | 1 |
| **Visualization** | data-visualization-engine | 1 |
| **Performance** | performance-budget-enforcer | 1 |
| **Reliability** | error-recovery-orchestrator | 1 |
| **Offline & Sync** | offline-sync-engine | 1 |
| **Prototyping** | interactive-prototype-builder | 1 |
| **UX & Polish** | error-message-optimizer | 1 |
| **Real-time** | real-time-collaboration-engine | 1 |
| **Code Quality** | contextual-ambiguity-detector | 1 |
| **Development Tools** | cursor-position-tracker | 1 |

## How Skills Work

### Each Skill Contains

1. **SKILL.md** - The core file with:
   - YAML frontmatter (name, version, description, author)
   - Decision Framework (when to use, when NOT to use)
   - Anti-Patterns (common mistakes to avoid)
   - Trigger Phrases (natural language activation)
   - Implementation Patterns (code templates)
   - Integration Points (how it works with other skills)

### Activation Flow

```
User Request → Trigger Matching → Skill Selection → Context Loading → Implementation
```

1. **Trigger Matching**: User's request matches a skill's trigger phrases
2. **Skill Selection**: Best matching skill is selected based on context
3. **Context Loading**: SKILL.md is read for decision framework and patterns
4. **Implementation**: Patterns are applied with project-specific adaptations

## Skill Reference

### High Priority (Core Infrastructure)

#### authentication-flow-designer
**Use when**: Login, registration, password reset, MFA, OAuth/OIDC, session management
**Don't use when**: API key auth only, simple token auth
**Key patterns**: OAuth2 flow, OIDC discovery, MFA TOTP/WebAuthn, session management
**Anti-patterns**: Storing passwords in plain text, JWT in localStorage, no CSRF protection

#### api-integration-layer
**Use when**: External API integration, REST/GraphQL clients, webhook handlers
**Don't use when**: Internal function calls, simple fetch operations
**Key patterns**: Client with retry/circuit breaker, request/response transforms, webhook verification
**Anti-patterns**: No timeout on requests, catching errors without handling, hardcoded URLs

#### database-schema-designer
**Use when**: New database design, schema migrations, performance optimization
**Don't use when**: NoSQL document design, simple key-value storage
**Key patterns**: Migrations, indexing strategy, normalization, read replicas
**Anti-patterns**: No indexes on foreign keys, storing JSON blobs in SQL, no migrations

#### deployment-pipeline-architect
**Use when**: CI/CD setup, automated deployments, environment management
**Don't use when**: Manual deployment is intentional, single-developer projects
**Key patterns**: GitHub Actions workflow, deployment stages, rollback strategy
**Anti-patterns**: Deploying directly to production, no rollback plan, secrets in code

#### multi-tenant-architecture
**Use when**: SaaS applications, white-label solutions, enterprise with divisions
**Don't use when**: Single-tenant application, personal projects
**Key patterns**: Shared DB with tenant ID, schema per tenant, database per tenant
**Anti-patterns**: No tenant isolation, shared sessions across tenants

#### state-machine-designer
**Use when**: Complex workflows, order processing, UI state management
**Don't use when**: Simple boolean states, linear flows
**Key patterns**: State machine class, statechart, XState integration
**Anti-patterns**: Boolean flags for complex states, no invalid state prevention

#### accessibility-pattern-library
**Use when**: Any UI component development, forms, navigation, modals
**Don't use when**: Non-UI code, backend-only services
**Key patterns**: ARIA attributes, keyboard navigation, focus management, screen reader support
**Anti-patterns**: Div buttons without roles, missing alt text, no focus indicators

### Medium Priority (Feature Support)

#### form-pattern-engine
**Use when**: Complex forms, validation, multi-step wizards
**Don't use when**: Simple single-field inputs
**Key patterns**: Field validation, multi-step wizard, conditional fields
**Anti-patterns**: No validation feedback, unclear required fields

#### dashboard-composition-engine
**Use when**: Admin panels, analytics dashboards, monitoring UIs
**Don't use when**: Simple data display, single chart
**Key patterns**: Widget grid, data aggregation, refresh strategy
**Anti-patterns**: Too many widgets, no loading states, hardcoded data

#### notification-system-builder
**Use when**: Multi-channel notifications, email alerts, push notifications
**Don't use when**: Simple console.log debugging
**Key patterns**: Channel abstraction, preference management, template system
**Anti-patterns**: No unsubscribe option, notification fatigue

#### search-experience-designer
**Use when**: Product search, content search, filtering interfaces
**Don't use when**: Simple find-in-array operations
**Key patterns**: Autocomplete, faceted search, result highlighting
**Anti-patterns**: No debouncing, searching on every keystroke

#### file-upload-orchestrator
**Use when**: File uploads, drag-and-drop, bulk uploads, resumable uploads
**Don't use when**: Simple single-file input
**Key patterns**: Chunked upload, progress tracking, validation
**Anti-patterns**: No file type validation, unlimited file sizes

#### data-visualization-engine
**Use when**: Charts, graphs, data dashboards, reports
**Don't use when**: Simple data tables
**Key patterns**: Chart components, data transformation, responsive charts
**Anti-patterns**: 3D charts, misleading axes, no legends

#### mobile-gesture-handler
**Use when**: Touch interactions, swipe actions, mobile-specific UX
**Don't use when**: Desktop-only applications
**Key patterns**: Touch detection, gesture recognition, haptic feedback
**Anti-patterns**: Tiny touch targets, no gesture feedback

#### workflow-automation-designer
**Use when**: Business process automation, task orchestration
**Don't use when**: Simple sequential scripts
**Key patterns**: Trigger → Condition → Action, retry policies
**Anti-patterns**: No error handling in workflows

#### component-lifecycle-manager
**Use when**: Complex component initialization, cleanup, side effects
**Don't use when**: Simple stateless components
**Key patterns**: Mount/unmount handling, effect cleanup, memoization
**Anti-patterns**: Memory leaks from uncleaned subscriptions

#### error-message-optimizer
**Use when**: User-facing error messages, form validation, API errors
**Don't use when**: Internal logging only
**Key patterns**: Error mapping, user-friendly messages, recovery actions
**Anti-patterns**: Stack traces to users, cryptic error codes

#### performance-budget-enforcer
**Use when**: Performance optimization, bundle size management
**Don't use when**: Performance is not a concern
**Key patterns**: Bundle analysis, lazy loading, caching strategies
**Anti-patterns**: Loading everything upfront, no performance monitoring

#### data-migration-orchestrator
**Use when**: Database migrations, data transformations, ETL processes
**Don't use when**: Simple schema changes
**Key patterns**: Migration scripts, rollback support, validation
**Anti-patterns**: No backups before migration, no rollback plan

#### feature-flag-system
**Use when**: Gradual rollouts, A/B testing, feature toggles
**Don't use when**: All features always on
**Key patterns**: Flag evaluation, targeting rules, kill switches
**Anti-patterns**: Feature flags that never get removed

#### error-recovery-orchestrator
**Use when**: Critical operations, distributed systems, data integrity
**Don't use when**: Simple try/catch sufficient
**Key patterns**: Saga pattern, compensation, circuit breaker
**Anti-patterns**: No retry limits, swallowing errors

#### offline-sync-engine
**Use when**: Offline-first apps, mobile with spotty connectivity
**Don't use when**: Always-online requirement
**Key patterns**: Local storage, sync queue, conflict resolution
**Anti-patterns**: No conflict resolution, data loss on reconnect

#### interactive-prototype-builder
**Use when**: Rapid prototyping, user testing, concept validation
**Don't use when**: Production code
**Key patterns**: Component playground, mock data, quick iteration
**Anti-patterns**: Prototype becomes production without refactor

### Lower Priority (Specialized)

#### real-time-collaboration-engine
**Use when**: Collaborative editing, live cursors, shared state
**Don't use when**: Single-user applications
**Key patterns**: WebSocket management, operational transform, presence
**Anti-patterns**: No reconnection logic, state conflicts

#### contextual-ambiguity-detector
**Use when**: Code review, architecture decisions, tech debt assessment
**Don't use when**: Simple code, well-documented decisions
**Key patterns**: Assumption detection, decision documentation
**Anti-patterns**: Too many false positives

#### cursor-position-tracker
**Use when**: Text editors, rich input, IME support
**Don't use when**: Simple input fields
**Key patterns**: Position tracking, selection management, IME handling
**Anti-patterns**: Breaking IME composition

## Using the Skill Manager

```bash
# Rebuild the index
python3 scripts/manage-skills.py index

# Search for skills
python3 scripts/manage-skills.py search "authentication"
python3 scripts/manage-skills.py search "upload"

# Validate all skills
python3 scripts/manage-skills.py validate

# Show statistics
python3 scripts/manage-skills.py stats

# Run tests
python3 test/test.py                    # Quick (5 tests)
python3 test/test-comprehensive.py      # Full (80+ assertions)
python3 test/test-errors.py             # Error recovery
```

## Adding a New Skill

1. Create directory: `skills/new-skill-name/`
2. Create `SKILL.md` with frontmatter:
```yaml
---
name: "New Skill Name"
version: "1.0.0"
description: "What this skill does"
author: "workspace"
activated: false
---
```
3. Add decision framework, trigger phrases, patterns
4. Run `python3 scripts/manage-skills.py index` to update index
5. Run `python3 test/test-comprehensive.py` to validate

## Best Practices

1. **Always check decision frameworks** before recommending a skill
2. **Watch for anti-patterns** - they prevent common mistakes
3. **Use trigger phrases** to understand user intent
4. **Combine skills** for complex features (e.g., auth + forms + notifications)
5. **Document decisions** when choosing between multiple valid approaches
