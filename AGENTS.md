# AI Agent Operating Guidelines & Rules

Welcome, Agent. This document defines the engineering protocols, architectural rules, and verification loops required for all code contributions in this workspace.

---

## 1. Core Operating Principles

1. **Verify Before Declaring Done**: Never assume code works. Run typechecks, linters, and unit tests before completing any task.
2. **Minimal, Focused Diffs**: Do not rewrite entire files when targeted edits suffice. Preserve existing style, formatting, and surrounding comments.
3. **No Blind Assumptions**: When requirements, APIs, or data schemas are unclear, inspect the codebase, consult documentation, or clarify with the user.
4. **Defensive & Clean Code**: Handle edge cases, null/undefined safety, error boundaries, and input validation explicitly.
5. **No Secret Leaks**: Never hardcode API keys, credentials, or private tokens. Use environment variables with `.env.example` templates.

---

## 2. Engineering Standards

- **Type Safety**: Avoid `any` / untyped code. Define explicit interfaces, types, and schemas.
- **Modularity**: Adhere to Single Responsibility Principle (SRP) and clean separation of concerns. Keep functions small and readable.
- **Testing**:
  - Add unit tests for every new business logic function or utility.
  - Add regression tests when fixing bugs.
  - Avoid flaky tests with hardcoded delays; use mocks and event-driven assertions.
- **Formatting & Style**: Comply with the configured workspace linter and formatter (e.g. Biome/ESLint/Ruff).

---

## 3. Standard Workflow for Any Task

1. **Understand & Plan**:
   - Inspect existing architecture in [`docs/ARCHITECTURE.md`](file:///C:/Users/sankette/Documents/Projects/ZedWorkspace/docs/ARCHITECTURE.md).
   - Review pending tasks in [`docs/TASKS.md`](file:///C:/Users/sankette/Documents/Projects/ZedWorkspace/docs/TASKS.md).
   - Formulate a clear step-by-step plan before writing code.
2. **Implement**:
   - Make atomic, intentional modifications.
3. **Validate**:
   - Execute the workspace test & validation command (e.g. `npm test`, `pytest`, `cargo test`).
   - Fix all type errors and lint warnings before marking task complete.
4. **Document**:
   - Update [`docs/TASKS.md`](file:///C:/Users/sankette/Documents/Projects/ZedWorkspace/docs/TASKS.md) and inline documentation where appropriate.
