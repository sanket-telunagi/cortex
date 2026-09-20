# Prerequisites & Requirements for Agentic Coding

To enable AI agents to produce robust, high-quality, production-grade code autonomously, the workspace is organized around 5 foundational pillars:

---

## 1. Context & Agent Directives (`AGENTS.md`)
- **System Instructions**: Define coding standards, architectural invariants, prohibited patterns, and styling guidelines.
- **Decision Records**: Keep architecture decision records (`docs/ADR/`) so agents understand *why* things were built a certain way.
- **Specification-First Flow**: Keep task specs, requirements, and state logs (`docs/TASKS.md`) for persistent cross-session memory.

---

## 2. Deterministic Verification Loops (The Agent's "Eyes")
AI agents rely on objective machine feedback to self-correct:
- **Strict Static Typing**: (e.g., TypeScript strict mode, Pyright / Mypy, Rust typechecker).
- **Fast Linters & Formatters**: (e.g., Biome, ESLint, Ruff, Clippy) to immediately catch syntax and semantic errors.
- **Automated Test Runners**: Fast unit and integration tests (e.g., Vitest, Jest, Pytest, Cargo Test) with high test coverage.
- **One-Step Validation Script**: A single command (e.g., `npm run check`, `just check`, or `make test`) that runs lint + typecheck + tests before finalizing any task.

---

## 3. Isolated & Deterministic Environments
- **Strict Package Lockfiles**: (`pnpm-lock.yaml`, `uv.lock`, `Cargo.lock`) to avoid drifting dependencies.
- **Environment Variable Isolation**: `.env.example` templates with validated schema parsers (e.g., Zod or Pydantic).
- **Containerization / Dev Containers**: (Optional) `.devcontainer/` or Docker for reproducible OS-level dependencies.

---

## 4. Source Control & Diff Hygiene
- **Granular Git Commits**: Logical, atomic commits with conventional commit messages (`feat:`, `fix:`, `refactor:`, `test:`).
- **Comprehensive `.gitignore`**: Preventing logs, build artifacts, and secret leakage.
- **CI Workflows**: GitHub Actions / GitLab CI executing identical verification steps.

---

## 5. Tooling & MCP (Model Context Protocol) Integration
- **Specialized Skills / Scripts**: Automated benchmark, migration, or domain-specific code generation scripts.
- **Knowledge Graph / Indexing**: Agent memory indexes (like Graphify) for large-scale codebase navigation.
