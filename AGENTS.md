# AGENTS.md

## UI/UX Skill

For frontend and UI/UX tasks:

1. Read `UI_UX_RULES.md`.
2. Read `DESIGN_SYSTEM.md`.
3. Inspect existing UI components.
4. If the UI/UX Pro Max skill is available in the project, load and use it.
5. Use UI/UX Pro Max for UI/UX design decisions, visual direction, design patterns, typography, color systems, and UX recommendations.
6. Treat the project's `DESIGN_SYSTEM.md` as the final source of truth for project-specific decisions.
7. Do not blindly copy recommendations from the skill if they conflict with the existing project architecture or design system.


## Project Agent Instructions

You are working inside a large, evolving software project.

Your primary responsibility is to make changes that are:

* Correct
* Maintainable
* Consistent
* Minimal
* Well-tested
* Compatible with the existing architecture

Do not make unnecessary architectural changes.

---

## 1. Understand Before Changing

Before modifying code:

1. Inspect the relevant project structure.
2. Identify the technology stack.
3. Read relevant project documentation.
4. Inspect existing implementations and reusable components.
5. Understand how the requested feature fits into the existing architecture.

Do not immediately start coding based only on the user's short request.

Prefer understanding the existing implementation over making assumptions.

---

## 2. Existing Architecture Has Priority

Respect the project's existing:

* Framework
* Folder structure
* Component architecture
* Styling system
* State management
* API structure
* Naming conventions
* Testing conventions
* Build system

Do not replace existing technologies or patterns unless there is a clear technical reason.

---

## 3. Reuse Before Creating

Before creating a new component, utility, hook, style, or pattern:

1. Search for an existing implementation.
2. Determine whether it can be reused.
3. Extend it when appropriate.
4. Only create something new when reuse is not appropriate.

Avoid duplicate implementations.

---

## 4. UI/UX Tasks

For any frontend or UI/UX task, ALWAYS read:

* `UI_UX_RULES.md`
* `DESIGN_SYSTEM.md`

These files are the source of truth for project-wide UI/UX decisions.

Also inspect existing UI components before creating new ones.

The UI should feel like one coherent product, not a collection of independently designed pages.

---

## 5. Design System Changes

If a genuinely new UI pattern, component, token, or interaction is introduced:

1. Determine whether it should become reusable.
2. Document it in `DESIGN_SYSTEM.md`.
3. Implement it using the established architecture.
4. Make future reuse possible.

Do not introduce undocumented visual patterns.

---

## 6. Scope Control

Keep changes focused on the requested task.

Do not:

* Rewrite unrelated code.
* Refactor unrelated modules.
* Change business logic unnecessarily.
* Add dependencies without justification.
* Change configuration without understanding its impact.
* Remove existing functionality without a clear reason.

---

## 7. Quality Check

Before considering a task complete:

* Review the changed code.
* Check for regressions.
* Run relevant tests.
* Check responsive behavior for UI changes.
* Check accessibility for UI changes.
* Check consistency with the design system.
* Check that existing functionality still works.

---

## 8. Communication

Before implementation, briefly identify:

* What you understand
* What you plan to change
* Which existing components/patterns you will reuse

After implementation, summarize:

* What changed
* Why it changed
* Tests/checks performed
* Any remaining concerns

Do not claim that something was tested if it was not actually tested.

---

## 9. Important Principle

Prefer:

> Understand → Plan → Reuse → Implement → Review → Test

over:

> Guess → Rewrite → Hope it works
