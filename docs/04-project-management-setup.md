# Project Management Setup — Meridian

**Document 4 of the SDLC series — Project Management Phase**
**Increment:** 1 (MVP)

---

## 1. GitHub Setup Walkthrough (since this is new to you)

**Repo & branch protection**

1. Create the repo (`meridian`), push the initial monorepo skeleton from the Design doc's structure.
2. `Settings → Branches` → add a protection rule on `main`: require a pull request before merging (this is what makes CodeRabbit's review meaningful even solo — you can't accidentally push straight to `main`).

**Labels** (`Issues → Labels`) — create this taxonomy:

| Label                                                                                     | Meaning                                    |
| ----------------------------------------------------------------------------------------- | ------------------------------------------ |
| `type:feature`                                                                            | New functionality                          |
| `type:chore`                                                                              | Setup, tooling, refactor, non-feature work |
| `type:bug`                                                                                | Defect fix                                 |
| `priority:P0`                                                                             | Blocks everything else (foundation)        |
| `priority:P1`                                                                             | Core MVP requirement                       |
| `priority:P2`                                                                             | Nice-to-have within MVP                    |
| `area:auth`, `area:documents`, `area:chat`, `area:forums`, `area:dashboard`, `area:infra` | Feature area                               |

**Milestones** (`Issues → Milestones`) — one per section in Part 2 below (`M0 Setup` through `M6 Deploy & Polish`). A milestone is just a due-date-optional bucket of Issues — GitHub shows you a progress bar automatically as you close issues.

**Project board** (`Projects` tab → **New project** → **Board** template):

- Columns: `Backlog`, `Todo`, `In Progress`, `In Review`, `Done`.
- Add an automation (built into the Projects template): issues move to `In Review` automatically when a linked PR opens, and to `Done` when the PR merges and the issue closes.
- Every Issue you create from Part 2 gets added to this board — that's your visual Kanban artifact for the portfolio.

**Per-task workflow:**

1. Pick an Issue → create a branch (`feat/auth-login`, matching the issue) → work in VS Code with OpenCode assisting.
2. Open a PR, link it to the Issue (`Closes #12` in the PR description auto-closes the issue on merge).
3. CodeRabbit reviews automatically; address comments as real review feedback (this is genuinely useful even solo — treat it as a second pair of eyes).
4. CI runs Oxlint + Prettier + TypeScript check + tests (wired up in M0 below).
5. Merge → issue closes → board updates.

---

## 2. Milestones (Increment 1 delivery plan)

Ordered so each milestone builds on a working foundation — nothing is "half-built" for long.

| Milestone                             | Goal                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| **M0 — Project Setup**                | Monorepo scaffolded, DB running, CI pipeline green, empty app deploys/runs end-to-end |
| **M1 — Auth & RBAC**                  | Login works; roles/claims system functional; protected routes enforced                |
| **M2 — Document Management**          | Upload/view/preview/delete documents with role-based access                           |
| **M3 — Real-time Chat**               | 1-on-1 + group chat working over WebSockets                                           |
| **M4 — Forums**                       | Categories, posts, comments, likes                                                    |
| **M5 — Dashboard**                    | Aggregated stats/widgets across all features                                          |
| **M6 — Polish, Testing & Deployment** | Test coverage pass, bug fixes, deployment target chosen and live                      |

---

## 3. Backlog: Epics → User Stories → Tasks

### M0 — Project Setup _(`area:infra`, mostly `priority:P0`)_

**Epic: Repository & Tooling Bootstrap**

- Initialize monorepo (npm workspaces): `apps/client`, `apps/server`, `packages/shared`
- Configure TypeScript (strict mode) in both apps + shared package
- Set up Oxlint + Prettier configs; add `lint`/`format` scripts
- Set up GitHub Actions CI: install → typecheck → lint → test, on every PR
- `docker-compose.yml` for local PostgreSQL
- Configure Prisma; write initial empty schema; verify migration runs

**Epic: App Skeletons**

- Scaffold Express app: base server, health-check route, error-handling middleware
- Scaffold Vite + React app: React Router set up with a placeholder route tree
- Wire client → server with one working end-to-end request (e.g. `/api/health`)

_Definition of done for M0: `docker-compose up` + `npm run dev` gives a running app; CI passes on an empty PR._

---

### M1 — Auth & RBAC _(`area:auth`)_

**Epic: Data Model**

- Prisma models: `User`, `Role`, `Claim`, `UserRole` (join), `RoleClaim` (join)
- Seed script: default Admin user + Admin role with all claims

**Epic: Authentication**

- `POST /auth/login` — validate credentials, issue access + refresh JWT (userId + roleIds only)
- `POST /auth/refresh` — rotate refresh token
- Password hashing (bcrypt/argon2) on user creation/reset
- Auth middleware: verifies JWT, attaches `req.user`

**Epic: Authorization**

- Role→claims resolver service with in-memory cache + invalidation hook on role edits
- `requireClaim(claimKey)` middleware factory, applied per-route
- `POST /users/:id/change-password`, Admin `POST /users/:id/reset-password`

**Epic: Role & User Management (Admin)**

- CRUD endpoints: `/roles`, `/claims` (list only), `/users`
- Assign multiple roles to a user (Discord-style)
- Frontend: Login screen, Admin Users screen, Admin Roles screen (claim multi-select)

_Definition of done for M1: Admin can log in, create a role with specific claims, assign it to a user, and that user's access is correctly restricted/allowed on a protected test route._

---

### M2 — Document Management _(`area:documents`)_

**Epic: Data Model**

- Prisma models: `DocumentCategory` (flat), `Document`, `DocumentRoleAccess` (join to `Role`), `DocumentAuditLog`

**Epic: Storage Layer**

- `StorageService` interface + `LocalDiskStorageService` implementation
- Multer config: mimetype allowlist, max size validation

**Epic: Document CRUD & Access**

- `POST /documents` (multipart upload + role-access selection at upload time)
- `GET /documents?categoryId=` — filtered to documents whose role-access intersects caller's roles
- `GET/PUT/DELETE /documents/:id` with role-access + claim checks
- `PUT /documents/:id/roles` — update accessible roles
- Audit log entry on every action

**Epic: Preview & UX**

- Authenticated streaming download endpoint (no static file serving)
- In-browser preview integration (PDF.js / office viewer for common types)
- Frontend: Category browser, upload modal (with role multi-select), document detail/preview page

_Definition of done for M2: a document uploaded with roles `[Employee]` is visible to Employee-role users and correctly hidden from a user with no matching role._

---

### M3 — Real-time Chat _(`area:chat`)_

**Epic: Data Model**

- Prisma models: `Conversation`, `ConversationParticipant`, `Message`, `MessageReaction`, `MessageSeen`

**Epic: REST + Socket Layer**

- `GET/POST /conversations` (auto-reuse existing 1-on-1 conversation)
- `GET/POST /conversations/:id/messages`
- Socket.io namespace `/chat`: `message:send/new`, `typing:start/stop`, `presence:update`, `message:seen`
- User search endpoint for starting new conversations

**Epic: Frontend**

- Conversation list + unread indicators
- Message thread UI with attachments, like-reaction, seen receipts
- Group conversation creation + participant management UI

_Definition of done for M3: two logged-in users (two browser sessions) can exchange messages in real time, with seen receipts updating live._

---

### M4 — Forums _(`area:forums`)_

**Epic: Data Model**

- Prisma models: `ForumCategory`, `ForumPost`, `ForumComment`, `ForumReaction` (Like only)

**Epic: CRUD**

- `GET/POST/PUT/DELETE /forums`, `/forum-categories`
- `GET/POST/DELETE /forums/:id/comments`
- Like toggle endpoint on posts/comments
- Forum audit trail entries

**Epic: Frontend**

- Forum category list, post list, post detail with threaded comments, like button

_Definition of done for M4: any authenticated user with the forum-view claim can see all posts (no private-forum logic to test), create/comment/like per their claims._

---

### M5 — Dashboard _(`area:dashboard`)_

**Epic: Aggregation API**

- `GET /dashboard/summary` — document stats (by category/extension), forum activity, chat unread count — response filtered by caller's claims

**Epic: Frontend**

- Dashboard widgets with charts (e.g. Recharts) for document/forum stats
- Unread chat indicator widget

_Definition of done for M5: dashboard reflects live data across all other features, and a user without forum-view claim doesn't see forum widgets._

---

### M6 — Polish, Testing & Deployment _(`area:infra`)_

**Epic: Testing**

- Backend integration tests: auth flow, permission middleware, one CRUD path per feature (Supertest)
- Frontend component tests for critical flows (React Testing Library)

**Epic: Documentation**

- OpenAPI/Swagger spec or Postman collection covering all endpoints
- README: setup instructions, architecture diagram, screenshots

**Epic: Deployment**

- Decide deployment target (revisit — deferred decision from Design phase)
- CI/CD: auto-deploy on merge to `main`
- Final theming pass on shadcn/Efferd blocks (avoid templated look, per Design doc risk note)

_Definition of done for M6 = Definition of Done for Increment 1 (see Project Charter, Section 7)._

---

## 4. Next Step

With the backlog and milestones defined, the next phase is **Implementation (M0 → M6)**, beginning with the M0 setup epics. When you're ready, we move into the Implementation phase and start scaffolding the actual repo.

---

_End of Document 4 — Project Management Setup_
