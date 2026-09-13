# Project Design System

> This document is the visual source of truth for the entire application.

Any frontend/UI/UX implementation should follow this document.

If a new reusable design pattern is introduced, update this document.

---

# 1. Design Philosophy

## Product Character

The interface should feel:

* Modern
* Premium
* Clean
* Professional
* Sophisticated
* Intuitive
* Consistent
* Accessible

## Core Principle

> Strong visual identity without sacrificing usability.

The design should not look like a generic template or automatically generated dashboard.

---

# 2. Design Tokens

> These values should be finalized after inspecting the existing application and selecting the project's visual direction.

## 2.1 Colors

### Brand

```text
Primary:
Primary Hover:
Primary Active:
Secondary:
```

### Background

```text
Background:
Surface:
Surface Elevated:
Surface Muted:
```

### Text

```text
Text Primary:
Text Secondary:
Text Muted:
Text Disabled:
```

### Border

```text
Border:
Border Subtle:
Border Strong:
```

### Semantic

```text
Success:
Warning:
Error:
Info:
```

### Dark Mode

Define dark-mode equivalents for all required semantic tokens.

---

# 3. Typography

## Font Family

```text
Primary:
Monospace:
```

## Scale

```text
Display:
H1:
H2:
H3:
H4:
Body Large:
Body:
Body Small:
Caption:
```

## Font Weights

```text
Regular:
Medium:
Semibold:
Bold:
```

## Rules

* Maintain a clear typographic hierarchy.
* Avoid excessive font sizes.
* Use consistent line heights.
* Do not introduce page-specific typography without justification.

---

# 4. Spacing

Use a consistent spacing scale.

Preferred base:

```text
4
8
12
16
20
24
32
40
48
64
80
```

Use the closest existing token instead of creating arbitrary spacing values.

---

# 5. Border Radius

Define a controlled radius system.

```text
XS:
SM:
MD:
LG:
XL:
FULL:
```

Use the same radius language throughout the application.

---

# 6. Borders

Define consistent border behavior.

```text
Default:
Subtle:
Strong:
Interactive:
```

Avoid unnecessary borders when spacing and elevation already provide sufficient separation.

---

# 7. Shadows / Elevation

Define a small number of elevation levels.

```text
None:
Subtle:
Medium:
Strong:
Overlay:
```

Shadows should communicate hierarchy, not decoration.

---

# 8. Motion

Animations should be subtle and purposeful.

Define:

```text
Fast:
Normal:
Slow:
```

Use motion for:

* State changes
* Hover
* Focus
* Opening/closing
* Loading
* Important transitions

Avoid excessive animation.

Respect reduced-motion preferences when appropriate.

---

# 9. Layout

## Application Shell

Define:

```text
Header height:
Sidebar width:
Content max width:
Page padding:
Section spacing:
```

## Grid

Define:

```text
Desktop columns:
Tablet columns:
Mobile columns:
Gap:
```

## Alignment

Prefer predictable alignment and consistent content edges across pages.

---

# 10. Breakpoints

Define project-specific breakpoints based on the actual frontend stack.

```text
Mobile:
Tablet:
Laptop:
Desktop:
Large Desktop:
```

Do not create unnecessary breakpoints.

---

# 11. Core Components

The following components should share a consistent visual language.

## Buttons

Define:

```text
Primary:
Secondary:
Tertiary:
Destructive:
Ghost:
Icon:
```

Each should define:

* Height
* Padding
* Typography
* Radius
* Border
* Hover
* Focus
* Active
* Disabled
* Loading

---

## Inputs

Define:

* Height
* Padding
* Radius
* Border
* Focus state
* Error state
* Disabled state
* Placeholder
* Label
* Help text

---

## Cards

Define:

* Background
* Border
* Radius
* Padding
* Elevation
* Header
* Content
* Footer

---

## Modal / Dialog

Define:

* Width
* Radius
* Padding
* Overlay
* Header
* Content
* Footer
* Close behavior

---

## Dropdown / Menu

Define:

* Trigger
* Item height
* Padding
* Hover
* Active
* Disabled
* Keyboard behavior

---

## Tabs

Define:

* Active state
* Inactive state
* Hover
* Indicator
* Spacing

---

## Tables

Define:

* Header
* Row height
* Borders
* Hover
* Selected state
* Empty state
* Loading state
* Mobile behavior

---

## Badges

Define:

* Default
* Success
* Warning
* Error
* Info
* Neutral

---

# 12. Navigation

Navigation must remain predictable across the application.

Define:

* Header
* Sidebar
* Mobile navigation
* Breadcrumbs
* Active state
* Hover state
* Collapsed state

Avoid changing navigation behavior between pages without a strong reason.

---

# 13. Page Patterns

Reusable page structures should be documented here.

Examples:

```text
Dashboard
List Page
Detail Page
Settings Page
Profile Page
Form Page
Authentication Page
Analytics Page
```

For each pattern define:

* Page header
* Primary action
* Content layout
* Secondary actions
* Loading state
* Empty state
* Error state
* Responsive behavior

---

# 14. States

Every important component should consider:

```text
Default
Hover
Focus
Active
Selected
Disabled
Loading
Success
Error
Empty
```

Not every component requires every state.

---

# 15. Accessibility

The design system must support:

* Keyboard navigation
* Visible focus
* Sufficient contrast
* Semantic HTML
* Accessible labels
* Appropriate touch targets
* Reduced motion where appropriate

Accessibility should be considered at the component level so that every page benefits automatically.

---

# 16. Responsive Rules

Components should adapt rather than simply shrink.

Examples:

```text
Desktop → full navigation
Tablet → compact navigation
Mobile → mobile navigation

Desktop table → full table
Mobile table → responsive alternative
```

Document component-specific responsive behavior when necessary.

---

# 17. Iconography

Define:

```text
Icon library:
Default icon size:
Small:
Medium:
Large:
Stroke/fill style:
```

Do not mix unrelated icon styles.

Icons should have consistent visual weight.

---

# 18. Images & Illustrations

Define:

```text
Image treatment:
Avatar style:
Illustration style:
Empty-state illustration style:
```

Avoid random illustration styles across pages.

---

# 19. Content & UX Writing

UI copy should be:

* Clear
* Concise
* Helpful
* Consistent

Actions should use meaningful verbs.

Error messages should explain:

1. What happened.
2. What the user can do.

Avoid unnecessary technical terminology in user-facing UI.

---

# 20. Design System Evolution

When changing the design system:

1. Identify affected components.
2. Update the design tokens.
3. Update reusable components.
4. Review affected pages.
5. Check responsive behavior.
6. Check accessibility.
7. Document the change.

Do not create local exceptions unless they are genuinely necessary.

---

# 21. Reference Pages

The project should have one or more reference pages that demonstrate the intended visual language.

Reference pages should demonstrate:

* Typography
* Colors
* Spacing
* Components
* Navigation
* States
* Responsive behavior

Future pages should be compared against these references.

---

# 22. Design Decision Log

When an important design decision is made, record it here.

Example:

```text
Decision:
Reason:
Date:
Affected components:
```

This prevents future agents from unknowingly reversing important design decisions.

---

# 23. Final Rule

Before adding a new visual pattern, ask:

> Does the project already have a pattern that solves this problem?

If yes:

> Reuse it.

If no:

> Create a reusable pattern and document it here.

The goal is not to make every page unique.

The goal is to make the entire product feel intentionally designed as one system.
