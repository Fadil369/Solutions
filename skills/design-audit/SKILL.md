---
name: "Design Audit"
version: "1.0.0"
description: "Reviews UI code for accessibility, consistency, and UX quality. Detects missing ARIA attributes, inconsistent spacing, color contrast issues, and broken responsive layouts."
author: "workspace"
activated: false
---

# Design Audit

Reviews UI code for accessibility, consistency, and UX quality. Detects missing ARIA attributes, inconsistent spacing, color contrast issues, and broken responsive layouts.

## Decision Framework

### When to Apply
Use when:
- Reviewing frontend components before merge
- Auditing existing UI for accessibility compliance
- Preparing for WCAG certification
- Onboarding new team members to design standards
- Customer complaints about usability

### When NOT to Apply
Don't use when:
- Prototyping phase (too early for strict audit)
- Backend-only code changes
- Design system is already enforced by linters

## Anti-Patterns Detected

### 1. Missing Accessibility Attributes
Interactive elements without proper ARIA support.

```html
<!-- BAD: No accessibility -->
<div class="button" onclick="submit()">Submit</div>

<!-- GOOD: Accessible -->
<button type="submit" aria-label="Submit form">Submit</button>
```

### 2. Inconsistent Spacing
Hardcoded spacing values instead of design tokens.

```css
/* BAD: Magic numbers */
.card { padding: 13px; margin: 7px; }
.header { padding: 16px; margin: 8px; }

/* GOOD: Design system */
.card { padding: var(--space-sm); margin: var(--space-xs); }
.header { padding: var(--space-md); margin: var(--space-sm); }
```

### 3. Color Contrast Failures
Text that doesn't meet WCAG AA contrast ratios (4.5:1 normal, 3:1 large).

```css
/* BAD: Low contrast */
.text { color: #999; background: #fff; } /* 2.85:1 ratio */

/* GOOD: Sufficient contrast */
.text { color: #595959; background: #fff; } /* 7:1 ratio */
```

### 4. Broken Responsive Layouts
Fixed widths that break on mobile.

```css
/* BAD: Fixed width */
.container { width: 1200px; }

/* GOOD: Responsive */
.container { max-width: 1200px; width: 100%; padding: var(--space-md); }
```

### 5. Missing Focus States
Interactive elements without visible focus indicators.

```css
/* BAD: No focus style */
button:focus { outline: none; }

/* GOOD: Visible focus */
button:focus-visible { 
  outline: 2px solid var(--color-focus); 
  outline-offset: 2px; 
}
```

## Audit Checklist

### Accessibility (WCAG 2.1 AA)
- [ ] All images have alt text
- [ ] Form inputs have associated labels
- [ ] Color is not the only way to convey info
- [ ] Text contrast meets 4.5:1 ratio
- [ ] All interactive elements keyboard accessible
- [ ] Focus order is logical
- [ ] ARIA roles used correctly
- [ ] Screen reader announcements for dynamic content

### Visual Consistency
- [ ] Spacing uses design tokens (4px/8px grid)
- [ ] Typography follows type scale
- [ ] Colors from defined palette
- [ ] Border radius consistent
- [ ] Shadows use elevation system
- [ ] Icons consistent size/style

### Responsive Design
- [ ] Works at 320px width
- [ ] Works at 768px width
- [ ] Works at 1280px width
- [ ] Touch targets ≥ 44px
- [ ] No horizontal scrolling
- [ ] Images responsive

### Interaction Quality
- [ ] Hover states on interactive elements
- [ ] Loading states for async operations
- [ ] Error states with clear messages
- [ ] Empty states with guidance
- [ ] Disabled states clearly indicated

## Severity Levels

| Level | Impact | Action Required |
|-------|--------|----------------|
| 🔴 Critical | Blocks users or violates WCAG | Fix immediately |
| 🟡 Warning | Degrades experience | Fix before release |
| 🔵 Info | Could improve | Consider for backlog |

## Integration with Other Skills

- **accessibility-pattern-library**: Deep accessibility patterns
- **form-pattern-engine**: Form-specific audits
- **mobile-gesture-handler**: Touch interaction validation
- **performance-budget-enforcer**: Asset optimization checks
