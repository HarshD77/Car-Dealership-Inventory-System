# Car Dealership Inventory System

This repository contains the completed local implementation of the required car
dealership inventory application:

- Backend: Node.js, TypeScript, Express, MongoDB, JWT, bcryptjs, and Zod
- Frontend: React, TypeScript, Vite, HTML5, CSS3, and Tailwind CSS
- Persistence: MongoDB; the application does not use an in-memory database

All three pages of `AI_Kata_Car_Dealership_Inventory_System_V2.pdf` were read from
the supplied file and visually checked during this Codex session. The implementation
also follows the more specific stack, permissions, stock, and testing requirements
in the original pasted request.

## Requirements status

- [x] Persistent MongoDB with isolated disposable test databases
- [x] Registration, password hashing, login, JWT validation, and admin setup
- [x] Authenticated vehicle create/list/search/update APIs and admin-only delete
- [x] Atomic one-unit purchase and admin-only positive-integer restock
- [x] Responsive registration, login, inventory, search, purchase, and admin UI
- [x] Loading, validation, success, error, empty, and pending states
- [x] Backend/frontend unit tests, coverage, production builds, and browser tests
- [x] Setup, API, assumptions, screenshot, and AI usage documentation
- [ ] User must export and append the complete raw AI conversation to [PROMPTS.md](PROMPTS.md)
- [ ] User must add their personal AI reflection to the section below
- [ ] User must publish the repository and supply its public URL; this is mandatory for submission

## Prerequisites

- Node.js 22.12 or newer
- npm
- A running MongoDB instance (verified locally with MongoDB 8.0)
- Google Chrome for the Playwright browser tests (the default browser channel)

## Setup

From the repository root:

```powershell
npm ci
npm run setup:env
```

The setup command creates [backend/.env](backend/.env) with a random local JWT
secret and preserves an existing file. It never overwrites local configuration.
For manual setup, copy [backend/.env.example](backend/.env.example) to
`backend/.env` and replace the JWT placeholder. The frontend proxy can be
configured by copying [frontend/.env.example](frontend/.env.example) to
`frontend/.env`; the default target is the local backend and normally needs no
change.

The application uses prices as nonnegative integer cents in USD. For example,
`42000.50` in the UI is sent to the API as `4200050`.

### MongoDB setup

The default connection is `mongodb://127.0.0.1:27017/car_dealership`.
Use an installed MongoDB service, or start MongoDB Community Server with a persistent
data directory. On Windows, check an existing service with `Get-Service MongoDB`.
If it is already running, no additional server is needed. If no service is running,
run these commands from the repository root in a separate terminal:

```powershell
New-Item -ItemType Directory -Force .local/mongodb
mongod --dbpath .local/mongodb --bind_ip 127.0.0.1 --port 27017
```

If `mongod` is not on PATH, use its installed absolute path; for example,
`& 'C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe'` followed by the same arguments.
MongoDB creates the application database when the first data is written. An existing
service retains data in its configured data directory. The manual setup retains it
in `.local/mongodb`, which is excluded from Git. Do not start a second server on an
occupied port. For a different MongoDB instance, edit `MONGODB_URI` in `backend/.env`.

## Admin setup

After configuring MongoDB and `backend/.env`, create an administrator locally:

```powershell
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_PASSWORD = "choose-a-password-of-at-least-8-characters"
npm run admin --workspace backend
Remove-Item Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD
```

The registration endpoint always creates a regular `user`; request bodies
cannot assign themselves the `admin` role.
Use a new email address: the command refuses duplicates rather than overwriting an
existing account. Passwords must be at least 8 characters and at most 72 UTF-8 bytes.
No admin password or populated development inventory is shipped. Create your own
admin, sign in, and use **Add vehicle**. Screenshot data exists only in the test database.

## Run the application

Run the backend and frontend in separate terminals:

```powershell
npm run dev:backend
npm run dev:frontend
```

Open <http://127.0.0.1:5173>. The backend serves the production frontend after
`npm run build` and starts on `http://127.0.0.1:3000` by default.

For a local production build:

```powershell
npm run build
npm run start --workspace backend
```

Open <http://127.0.0.1:3000>. Vite proxies `/api` during development; Express serves
the compiled SPA and API from the same origin in the production build. Both servers
bind locally. JWTs expire after one hour. The UI keeps the session in per-tab
`sessionStorage`, clears it on sign-out, and returns to sign-in after a 401 response.

## API

Authentication endpoints do not require a token:

- `POST /api/auth/register` with `{ "email": "...", "password": "..." }`
- `POST /api/auth/login` with the same body

Both authentication endpoints return `{ "token": "...", "user": { "id": "...",
"email": "...", "role": "user" } }`. Password hashes are never returned.
Send `Authorization: Bearer <token>` for every vehicle endpoint:

- `POST /api/vehicles` - create a vehicle
- `GET /api/vehicles` - list all vehicles, including zero-stock vehicles
- `GET /api/vehicles/search` - combine any filters; prices are cents
- `PUT /api/vehicles/:id` - replace a vehicle
- `DELETE /api/vehicles/:id` - admin only
- `POST /api/vehicles/:id/purchase` - purchase one unit; request body is `{}` or omitted
- `POST /api/vehicles/:id/restock` - admin only; body is `{ "quantity": 1 }` with a positive integer

Create and update are authenticated-user API operations because the assignment
explicitly restricts deletion, while the frontend exposes create/update controls
only to administrators. Purchase stock changes use one atomic MongoDB
conditional update, so concurrent requests cannot make quantity negative.
This follows [MongoDB's single-document atomicity guidance](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/).

Create and update accept all five fields below. `PUT` is a complete replacement of
these details, including the absolute stock quantity; it does not accept partial updates.
Responses include the stable `id` in addition to these fields. Lists/search return
arrays, and successful deletion returns HTTP 204 with no body.

```json
{ "make": "Volvo", "model": "XC60", "category": "SUV", "price": 4890000, "quantity": 3 }
```

| Search parameter            | Meaning                                                        |
| --------------------------- | -------------------------------------------------------------- |
| `make`, `model`, `category` | Case-insensitive literal substring matches; combine using AND  |
| `minPrice`, `maxPrice`      | Inclusive bounds in integer cents; either bound may be omitted |

Example: `/api/vehicles/search?make=volvo&category=suv&minPrice=3000000&maxPrice=5000000`.
Omit unused parameters instead of sending empty strings. Text is trimmed and limited
to 100 characters. Prices and stock must be safe integers from 0 through
`Number.MAX_SAFE_INTEGER`; restock must be at least 1. IDs are MongoDB ObjectIds.
Validation errors return 400, invalid credentials/tokens 401, forbidden admin
actions 403, missing vehicles 404, and duplicate email/out-of-stock/overflow 409.
Errors use `{ "error": "..." }`, with field-level `details` on validation errors.

## Tests, coverage, and build

Backend and browser tests connect to real MongoDB. They ignore `backend/.env` and
the development `MONGODB_URI`. By default the test base URI is
`mongodb://127.0.0.1:27017/car_dealership_test`; each run creates a separate randomly
suffixed database and deletes only that database at teardown. A supplied base name
must end in `_test`. To use another instance, set `TEST_MONGODB_URI` in the terminal.
Frontend component tests mock HTTP responses; browser tests use the real Express API.

```powershell
npm test
npm run test:coverage
npm run typecheck
npm run build
npm run test:e2e
```

`test:e2e` rebuilds both applications, creates an isolated database, invokes the real
admin CLI, starts a backend on a free local port, launches headless Chrome, captures
screenshots, and cleans up its own process/database. It does not need running dev
servers. For installed Edge, set `$env:PLAYWRIGHT_CHANNEL = 'msedge'`. Tests use random
temporary passwords and JWT secrets. No test credentials are valid in development.

The latest verified results in this workspace are:

- Backend: 80 tests passed; 97.88% statements, 97.74% lines, 98.30% branches
- Frontend: 32 tests passed; 92.38% statements, 96.85% lines, 90.98% branches
- Playwright: 3 tests passed, covering registration/search/purchase, admin inventory flows, and persistence after backend restart
- Type checks and both production builds passed
- Formatting check passed. The final browser run passed all three scenarios after
  extending its readiness deadline for slow local process starts.

Machine-readable reports are generated in [backend/reports](backend/reports)
and [frontend/reports](frontend/reports). HTML coverage reports are generated
under [backend/coverage](backend/coverage) and [frontend/coverage](frontend/coverage).
Open `backend/coverage/index.html` or `frontend/coverage/index.html` after running
coverage. The browser HTML report is `frontend/playwright-report/index.html`.
Checked-in snapshots are [backend tests](backend/reports/tests.json),
[backend coverage](backend/reports/coverage-summary.json),
[frontend tests](frontend/reports/tests.json),
[frontend coverage](frontend/reports/coverage-summary.json), and
[browser results](frontend/reports/e2e.json). The test commands regenerate current
reports; coverage snapshots were copied from the actual coverage output for submission.
Backend coverage excludes the server and admin CLI entrypoints; the browser suite
exercises both entrypoints, including a real backend process restart. Coverage is
reported separately from the browser scenarios.

### Code layout and TDD evidence

- `backend/src/auth`: credential handling, routes, and JWT/admin middleware.
- `backend/src/vehicles`: validation, MongoDB access, routes, and stock rules.
- `backend/tests`: real database integration tests and configuration checks.
- `frontend/src/components`: authentication, dashboard, filters, cards, and admin dialogs.
- `frontend/e2e`: browser scenarios, temporary database setup, and restart verification.

Git history contains actual failing-test commits followed by passing implementation
commits, beginning with registration and continuing through the admin UI. No history
was reconstructed after implementation. For example, `b0c465c` records failing
purchase/restock tests and `6ddaf80` records their passing implementation. Every local
commit made by Codex carries an AI co-author trailer. `git log --format=full` shows it.

## Screenshots

The browser suite captures the verified UI states in [screenshots](screenshots):

- [login-desktop.png](screenshots/login-desktop.png)
- [inventory-desktop.png](screenshots/inventory-desktop.png)
- [inventory-mobile.png](screenshots/inventory-mobile.png)
- [admin-desktop.png](screenshots/admin-desktop.png)
- [admin-form.png](screenshots/admin-form.png)
- [admin-form-mobile.png](screenshots/admin-form-mobile.png)

## Assumptions and scope

- One purchase click decreases stock by exactly one.
- Restock quantity must be a positive integer.
- Currency is USD because the assignment does not specify a currency.
- No payments, carts, wishlists, purchase history, analytics, notifications,
  image uploads, password reset, or deployment features were added.
- The local Playwright suite uses a random test database and removes it during
  teardown.
- “Motorline” branding and the generic car outline are presentation choices. The
  outline is decorative, not an uploaded image or a representation of a specific model.
- Sign-out, deletion confirmation, retry buttons, and form feedback support the
  requested authentication and inventory flows. They do not add business features.
- Vite, Vitest, Testing Library, Playwright, and Prettier are development/testing
  tools, not additional product scope. There are no third-party UI component libraries.

### PDF requirement audit (24 October 2026)

| Assignment requirement                                       | Status and evidence                                                                 |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Allowed backend stack and persistent database                | Met: Node/TypeScript/Express with MongoDB; process-restart test passes              |
| Registration, login, token authentication                    | Met: implemented and integration-tested                                             |
| Five protected vehicle routes and required fields            | Met: exact routes, all six vehicle fields including ID                              |
| Admin-only delete and restock                                | Met: enforced by backend, tested with regular and admin users                       |
| Purchase decreases quantity                                  | Met: atomic conditional write; twelve last-unit purchase attempts yield one success |
| React, HTML5, CSS3, Tailwind SPA                             | Met: source and production build verified                                           |
| Auth forms, inventory dashboard, filters, purchase, admin UI | Met: component tests and real browser workflows                                     |
| Purchase disabled at zero stock                              | Met: UI and backend rejection verified                                              |
| Responsive and visually appealing design                     | Implemented; screenshots reviewed and overflow checks pass at 320/390/768/1440px    |
| TDD, clean code, meaningful tests, frequent Git commits      | Met with recorded red/green progression and separated responsibilities              |
| AI co-authorship                                             | Met for every Codex-created commit                                                  |
| README setup, screenshots, test report                       | Met; links and reproducible commands above                                          |
| Detailed “My AI Usage” and personal reflection               | Tool/process details documented; personal reflection still required                 |
| Raw AI conversations/public chat links in root PROMPTS.md    | Incomplete: original request only; full conversation export required                |
| Public Git repository link                                   | Incomplete: no remote/publication configured                                        |
| Interview discussion of AI usage                             | User preparation remains; cannot be fulfilled by generated code                     |
| Deployed application                                         | Optional in the PDF and explicitly outside the requested implementation             |

No unrequested payments, carts, wishlists, history, analytics, notifications, uploads,
or password-reset features were found in the implementation.

## My AI Usage

**Verified tool usage in this conversation:** OpenAI Codex read the assignment PDF
using Python PDF tools, wrote the initial project, tests, API, and React components,
ran red/green cycles, fixed observed failures, captured screenshots with Playwright,
and prepared documentation. It also consulted the official MongoDB, Express, and
Tailwind documentation. No external project's application code was copied.

**Observed impact:** AI produced and revised substantial implementation and test
code. Running it exposed real issues, including duplicate email races, a frontend
test-matcher compatibility problem, and a browser-launcher path mistake. The
recorded test runs and commits preserve those corrections. This description is a
factual account of the assisted work, not the submitter's personal reflection.

An intervening README edit mentioned a Copilot SDK/VS Code continuation. That usage
cannot be verified from this Codex conversation. If another AI tool was actually
used, add its exact role and include its raw conversations too.

**Personal reflection: INCOMPLETE.** The submitter must explain in their own words
what they reviewed, understood or changed, how AI affected their workflow, and what
they learned. Prepare to discuss the implementation and AI assistance in the interview.

The complete raw conversation is not available for automatic export in this
workspace. Before submission, export the full unedited chat (user messages,
assistant messages, and tool activity if available) from the AI client and
append it to [PROMPTS.md](PROMPTS.md), or add a public chat link there. Do not
replace it with a summary. The full transcript and personal reflection are mandatory.

## Submission steps still requiring the user

1. Export and append the complete raw AI conversation to [PROMPTS.md](PROMPTS.md).
2. Complete the personal reflection and confirm any AI tools used outside this chat.
3. Create a public repository, push this repository with its existing TDD history,
   and provide the public URL. Publication requires explicit user authorization;
   no external publication was performed by Codex.
4. Prepare to explain the code, tests, stock concurrency, and AI usage in the interview.
