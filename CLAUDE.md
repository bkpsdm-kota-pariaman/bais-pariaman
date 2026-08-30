# CLAUDE.md — BAIS Pariaman

> Instruksi operasional singkat untuk Claude/AI coding agent.
>
> `AGENTS.md` adalah aturan utama project. Jika ada konflik, ikuti `AGENTS.md` dan dokumentasi task yang relevan.

---

## 1. MANDATORY STARTUP

Setiap sesi baru:

```text
DO NOT rely on previous conversation memory.

READ AGENTS.md FIRST.

READ TASK_INSTRUCTION.md before coding.

For testing tasks:
READ TESTING.md.

For feature/behavior tasks:
READ PRD.md.

For architecture tasks:
READ ARCHITECTURE.md.

For UI/UX tasks:
READ DESIGN.md.

For security/auth/API tasks:
READ SECURITY.md.

For deployment/build tasks:
READ DEPLOYMENT.md.
```

Jangan mulai coding sebelum dokumentasi relevan dibaca.

---

## 2. BAIS PROJECT CONTEXT

```text
BAIS Pariaman
↓
PWA Frontend + Admin Dashboard
↓
Native HTML/CSS/JavaScript
↓
PHP Native + FastRoute API
↓
JWT Authentication
↓
MySQL/MariaDB
↓
Node.js Worker
```

Source frontend:

```text
src/Views/
```

Generated frontend:

```text
docs/
```

Backend:

```text
public_html/api/
```

Tests:

```text
tests/
```

---

## 3. IMPORTANT E2E CONTEXT

Untuk Playwright E2E:

```text
Playwright
↓
Browser
↓
BAIS frontend ASLI
↓
local web server
↓
docs/
↓
remote BAIS testing backend ASLI
↓
testing database/service
```

Localhost hanya untuk menyajikan frontend asli.

Backend E2E tetap remote.

Jangan membuat:

```text
fake frontend
fake HTML
fake backend
fake API
fake server
```

Jangan arahkan E2E ke production backend.

---

## 4. TESTING RULES

E2E harus:

```text
simulate real user interaction
use real browser
use real BAIS frontend
use real remote testing backend
verify user-visible behavior
```

Text input wajib:

```javascript
pressSequentially('text', { delay: 100 })
```

Jangan gunakan `fill()` untuk simulasi user mengetik.

Browser console harus dipantau.

Unexpected:

```text
console.error
pageerror
uncaught exception
unhandled rejection
```

harus membuat test FAIL.

---

## 5. TEST EXECUTION

AI **jangan otomatis menjalankan test**.

User yang menjalankan test.

Setelah coding, berikan command:

```bash
npm run test:e2e
```

atau test tertentu:

```bash
npx playwright test tests/e2e/<file>.spec.js
```

Jangan menyatakan PASS/FAIL sebelum user memberikan hasil.

---

## 6. PRODUCTION CODE PROTECTION

Never:

```text
modify production code solely to make test PASS
hide browser errors
weaken assertions
mock the real backend in normal E2E
replace UI interaction with internal function calls
invent missing behavior
```

Jika gagal:

```text
TEST BUG
APPLICATION BUG
ENVIRONMENT BUG
REQUIREMENT UNCLEAR
```

Cari akar masalah.

---

## 7. CHANGE DISCIPLINE

Sebelum coding:

```text
READ
UNDERSTAND
CHECK EXISTING CODE
CHECK IMPACT
CHANGE
```

Buat perubahan minimal.

Jangan refactor unrelated code.

Jangan edit `docs/` manual.

Jangan bypass security.

---

## 8. USER INTENT

User sering berganti model AI.

Karena itu:

```text
DO NOT ASSUME PREVIOUS AI CONTEXT EXISTS.
DO NOT ASSUME PREVIOUS MODEL MEMORY EXISTS.
ALWAYS RE-READ PROJECT DOCUMENTATION.
```

Dokumentasi project adalah persistent context.


<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **bais-pariaman** (2880 symbols, 8508 relationships, 219 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/bais-pariaman/context` | Codebase overview, check index freshness |
| `gitnexus://repo/bais-pariaman/clusters` | All functional areas |
| `gitnexus://repo/bais-pariaman/processes` | All execution flows |
| `gitnexus://repo/bais-pariaman/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
