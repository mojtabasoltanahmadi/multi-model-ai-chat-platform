# UI/UX Rules

## Purpose

These rules define how UI/UX must be designed and implemented across the entire project.

The objective is:

> Distinctive UI + Excellent UX + Strong Consistency + Scalable Frontend Architecture

The application should feel as if it was designed by one experienced product design and engineering team.

## UI/UX Pro Max

When available, use the UI/UX Pro Max skill as a specialized UI/UX design assistant.

Use it to help with:

- Visual design direction
- UI style selection
- Color palette
- Typography
- Layout patterns
- UX patterns
- Responsive design
- Accessibility
- UI anti-pattern detection
- Design-system recommendations

However:

UI/UX Pro Max provides recommendations.

`DESIGN_SYSTEM.md` is the project's final visual source of truth.

Do not introduce a new visual pattern solely because the skill recommends it.

If the project already has an established pattern, prefer the existing project pattern unless there is a strong reason to change it.

---

# 1. Source of Truth

Before any frontend/UI/UX work, read:

* `DESIGN_SYSTEM.md`
* Existing reusable UI components
* Existing page/layout patterns

The design system takes priority over page-specific visual decisions.

If an existing component and a new design idea conflict, prefer the existing component unless there is a strong reason to change the shared component.

---

# 2. Design Philosophy

The interface should be:

* Modern
* Premium
* Clean
* Professional
* Sophisticated
* Intuitive
* Accessible
* Responsive
* Production-ready

Avoid generic AI-generated interfaces.

The UI should have a clear visual identity without becoming visually noisy.

---

# 3. Consistency Is More Important Than Novelty

Do not create a new visual style for every page.

Once a visual pattern is established, reuse it.

Examples:

* Buttons should share the same visual language.
* Cards should follow the same structure.
* Forms should behave consistently.
* Navigation should remain predictable.
* Typography should follow the same hierarchy.
* Spacing should follow the same scale.
* Interactive states should behave consistently.

Creative design is encouraged **within the design system**.

---

# 4. Reuse Existing Components

Before creating a component:

1. Search existing components.
2. Reuse an existing component if possible.
3. Extend an existing component if appropriate.
4. Create a new component only when necessary.

Do not create visually duplicated components.

Prefer:

```text
One reusable Button
```

over:

```text
DashboardButton
SettingsButton
ProfileButton
```

when they represent the same UI concept.

---

# 5. Design Tokens

Do not randomly choose values for:

* Colors
* Spacing
* Font sizes
* Border radius
* Shadows
* Transitions
* Breakpoints

Use the project's design tokens defined in `DESIGN_SYSTEM.md`.

If a new token is genuinely necessary, document it before introducing widespread usage.

---

# 6. Layout

Layouts should have:

* Clear hierarchy
* Consistent alignment
* Predictable spacing
* Appropriate content width
* Balanced density
* Strong visual grouping

Avoid excessive empty space when it harms usability.

Avoid overly dense layouts when they harm readability.

---

# 7. Typography

Typography must communicate hierarchy clearly.

Use consistent:

* Heading levels
* Font sizes
* Font weights
* Line heights
* Text colors

Do not use typography merely as decoration.

Long text must remain readable on smaller screens.

---

# 8. Color

Use the project's defined color system.

Color should communicate:

* Hierarchy
* State
* Importance
* Feedback
* Interaction

Do not introduce arbitrary colors for individual pages.

Do not overuse gradients, neon colors, or decorative color effects.

---

# 9. Components

Reusable components should have consistent:

* Dimensions
* Padding
* Typography
* Radius
* Borders
* Shadows
* Interaction states

Core components should normally support:

* Default
* Hover
* Focus
* Active
* Disabled
* Loading
* Error where applicable

---

# 10. Interaction Design

Interactions should provide clear feedback.

Users should understand:

* What is clickable
* What is currently selected
* What is loading
* What succeeded
* What failed
* What changed

Use subtle transitions where they improve clarity.

Avoid animation that exists only for decoration.

---

# 11. Loading States

Important asynchronous content should have appropriate loading states.

Prefer:

* Skeletons
* Progress indicators
* Button loading states
* Content placeholders

Avoid making the interface appear frozen.

---

# 12. Empty States

Empty states should explain:

1. What is empty.
2. Why it may be empty.
3. What the user can do next.

Avoid blank screens whenever possible.

---

# 13. Error States

Errors should be:

* Understandable
* Actionable
* Visually clear
* Non-destructive where possible

Prefer explaining what happened and what the user can do next.

Avoid exposing raw technical errors to normal users.

---

# 14. Forms

Forms should have:

* Clear labels
* Logical grouping
* Appropriate input types
* Validation feedback
* Clear submit actions
* Loading states
* Error states
* Success feedback

Do not rely only on placeholder text as a label.

---

# 15. Accessibility

Accessibility is part of the design, not an optional feature.

Consider:

* Semantic HTML
* Keyboard navigation
* Visible focus states
* Color contrast
* Accessible labels
* Appropriate button sizes
* Screen-reader compatibility
* Reduced motion preferences when relevant

Do not sacrifice accessibility for visual appearance.

---

# 16. Responsive Design

Every page must be intentionally responsive.

Support:

* Mobile
* Tablet
* Laptop
* Desktop
* Large screens

Do not simply shrink the desktop layout.

Consider how components should actually behave at different sizes.

Pay special attention to:

* Navigation
* Sidebars
* Tables
* Forms
* Modals
* Cards
* Long content
* Touch interactions

---

# 17. Mobile

Mobile layouts should be designed intentionally.

Avoid:

* Horizontal overflow
* Tiny controls
* Desktop navigation squeezed into mobile
* Unusable tables
* Excessive modal content

Important actions should remain easy to access.

---

# 18. Visual Hierarchy

Every page should have a clear hierarchy:

```text
Primary goal
    ↓
Important information
    ↓
Secondary information
    ↓
Supporting information
```

Users should understand the purpose of the page quickly.

---

# 19. Avoid UI Anti-Patterns

Avoid unnecessary:

* Glassmorphism
* Huge rounded cards
* Excessive gradients
* Excessive shadows
* Decorative animations
* Giant typography
* Random badges
* Excessive borders
* Visual noise
* Unnecessary icons

These techniques may be used when they serve the product's visual language, but never simply because they look fashionable.

---

# 20. Page Design

Before designing a page, identify:

1. Primary user goal
2. Primary action
3. Important information
4. Secondary actions
5. Possible empty state
6. Loading state
7. Error state
8. Responsive behavior

Design around the user's task rather than around decorative elements.

---

# 21. New Patterns

If a new component or visual pattern is introduced:

Ask:

> Is this genuinely different from an existing pattern?

If not, reuse the existing pattern.

If yes:

1. Define it clearly.
2. Make it reusable where appropriate.
3. Document it in `DESIGN_SYSTEM.md`.

---

# 22. Visual Review

After implementing UI, perform a visual review.

Check:

### Visual

* Typography
* Spacing
* Alignment
* Colors
* Radius
* Borders
* Shadows
* Hierarchy

### UX

* Navigation
* Discoverability
* Feedback
* Loading
* Empty states
* Error states

### Responsive

* Mobile
* Tablet
* Desktop
* Overflow
* Touch targets

### Accessibility

* Keyboard
* Focus
* Labels
* Contrast
* Semantic structure

### Consistency

Compare the page against existing pages and `DESIGN_SYSTEM.md`.

Fix inconsistencies before finishing the task.

---

# 23. Final Principle

The project should feel:

> Designed, not generated.

Every page should belong to the same product.

Every component should feel like part of the same system.

Every future page should be able to reuse the same design language without reinventing the UI.
