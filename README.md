# Car Dealership Inventory System

Implementation in progress. Node.js + TypeScript + Express, persistent MongoDB,
and React + Tailwind CSS. The assignment PDF was read in full (three pages).

## Requirements and implementation checklist

- [ ] Persistent MongoDB; isolated disposable test databases; no application memory store.
- [ ] Registration, secure password hashing, login, JWT verification, role checks, admin setup.
- [ ] Protected create/list/search/update vehicle APIs; admin-only delete.
- [ ] Atomic one-unit purchase; admin-only positive-integer restock.
- [ ] React registration/login/dashboard, combined filters, purchase and admin controls.
- [ ] Responsive design; loading, empty, success, error, validation and pending states.
- [ ] Backend and frontend tests, coverage, builds, browser screenshots, persistence check.
- [ ] Complete setup/API documentation, AI attribution and submission instructions.
- [ ] User action: full raw conversation export, personal AI reflection, public repository.

Implementation follows this order, with actual failing tests committed before the
code that makes them pass. No retrospective TDD history will be created.

## Decisions

- API and database prices are nonnegative integer cents in USD. UI inputs/display
  use dollars. The assignment does not specify a currency.
- All vehicle endpoints require JWT authentication. Add/update APIs accept any
  authenticated user; only admins see the add/update UI. Delete/restock APIs are
  admin-only. This preserves the assignment's explicit permission distinction.
- Purchases decrement one vehicle per click. Restock accepts `{ "quantity": 1 }`
  with a positive integer. Zero-stock vehicles remain visible.
- No deployment or external publication is included.

## My AI Usage

OpenAI Codex is being used to read the assignment, write tests and implementation,
run checks, debug failures, and prepare documentation in this local repository.
AI-assisted commits include `Co-authored-by: OpenAI Codex <AI@users.noreply.github.com>`.
There were no pre-existing repository instructions conflicting with the PDF's
attribution policy. The final documentation will distinguish performed work from
remaining user actions. The submitter must add their own honest reflection; this
agent cannot invent their personal experience.

The complete raw conversation export is still required; see [PROMPTS.md](PROMPTS.md).
