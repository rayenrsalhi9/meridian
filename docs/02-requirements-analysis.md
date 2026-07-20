# Requirements Analysis — Meridian

**Document 2 of the SDLC series — Requirements Phase**
**Increment:** 1 (MVP)

---

## 1. Personas

### 1.1 Admin (Super Admin)

Full system control. Creates roles, assigns permission claims, manages users, has unrestricted access to all documents, forums, and chat moderation tools.

### 1.2 Manager / Role-holder (e.g., "Tech Support", "HR")

A role created by Admin with a specific subset of permission claims (e.g., can manage a document category, moderate forums, but not manage users).

### 1.3 Standard Employee

Baseline authenticated user. Can use chat, participate in forums (per claims), view documents they have access to.

### 1.4 Guest / Unauthenticated Visitor

Not permitted into any application feature. An unauthenticated visitor only sees the public **Home page** — no application feature or data is accessible pre-login. Home page content/sections to be defined in detail later.

---

## 2. Functional Requirements

### 2.1 Authentication & RBAC

| ID        | Requirement                                                                                                                                                                                                                                                                                                                      |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-HOME-1 | Unauthenticated visitors are shown a single public Home page; no application feature or data is accessible pre-login. Home page content/sections to be defined later                                                                                                                                                             |
| FR-AUTH-1 | Users authenticate via email + password; system issues a JWT access token (+ refresh token)                                                                                                                                                                                                                                      |
| FR-AUTH-2 | JWT carries only `userId` and assigned `roleId(s)` — no claims. On each request, the Auth middleware resolves current permission claims via a role→claims lookup, cached (in-memory/Redis) and invalidated immediately whenever Admin edits a role's claims, so permission changes take effect without waiting for token refresh |
| FR-AUTH-3 | Admin can create/edit/delete **roles**, each composed of a selectable set of **permission claims**                                                                                                                                                                                                                               |
| FR-AUTH-4 | Admin can assign one or more roles to a user (Discord-style multi-role model) — a user's effective permissions are the **union** of claims across all their assigned roles                                                                                                                                                       |
| FR-AUTH-5 | Admin can create user accounts (self-registration out of scope for MVP, matching original)                                                                                                                                                                                                                                       |
| FR-AUTH-6 | Users can change their own password; Admin can force-reset any user's password                                                                                                                                                                                                                                                   |
| FR-AUTH-8 | Middleware enforces claim-based authorization on every protected API route                                                                                                                                                                                                                                                       |
| FR-AUTH-9 | Login attempts (success/failure, IP, timestamp) are logged for audit                                                                                                                                                                                                                                                             |

_Deferred to a later increment: self-service "forgot password" flow (email code/link → reset). For MVP, only Admin-initiated password resets (FR-AUTH-6) are available._

### 2.2 Document Management

| ID       | Requirement                                                                                                                                                                                                                                                                             |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-DOC-1 | Users with appropriate claims can upload files (documents, images, PDFs, media) into a **category**                                                                                                                                                                                     |
| FR-DOC-2 | Documents are organized into simple, flat categories (e.g. "Proposals", "Contracts", "HR Documents") — no nesting/sub-categories. Categories are purely organizational (for browsing/filtering), not an access-control unit                                                             |
| FR-DOC-3 | Access control is **role-based, chosen at upload time**: since every user has one or more roles, the uploader selects which role(s) can access the document when uploading (or later editing) it. A viewing user can see/access the document if they hold **any** of its selected roles |
| FR-DOC-4 | Document owner/Admin can edit a document's role-access list at any time via a simple multi-select of existing roles (no per-user sharing, no separate share mechanism — one consistent role-based model)                                                                                |
| FR-DOC-5 | Supported actions per document, gated by permission: view, download, edit (metadata/replace file), delete                                                                                                                                                                               |
| FR-DOC-6 | In-browser preview for common types (PDF, images, Office docs via a viewer library)                                                                                                                                                                                                     |
| FR-DOC-7 | Every document action (upload, view, edit, delete, download) is recorded in an audit trail (who, what, when)                                                                                                                                                                            |
| FR-DOC-8 | Dashboard-ready stats: document counts by category and file extension                                                                                                                                                                                                                   |

### 2.3 Real-Time Chat

| ID        | Requirement                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| FR-CHAT-1 | Users can start a 1-on-1 conversation with any other user (auto-reuses existing conversation if one exists) |
| FR-CHAT-2 | Users can create named group conversations with multiple participants                                       |
| FR-CHAT-3 | Messages support text content and file attachments                                                          |
| FR-CHAT-4 | Messages support emoji reactions                                                                            |
| FR-CHAT-5 | Read receipts ("seen") tracked per message per participant                                                  |
| FR-CHAT-6 | Group conversation admins/creators can add/remove participants                                              |
| FR-CHAT-7 | Real-time delivery via WebSockets; user can search other users to start a conversation                      |

### 2.4 Forums

| ID         | Requirement                                                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-FORUM-1 | All forum browsing requires authentication — no public/unauthenticated access (see FR-HOME-1)                                                |
| FR-FORUM-2 | Authenticated users with claims can create/edit/delete forum posts                                                                           |
| FR-FORUM-3 | Forums organized into categories                                                                                                             |
| FR-FORUM-4 | No private/restricted forums — a post is visible to any authenticated user who holds the forum-view claim; there is no per-post visitor list |
| FR-FORUM-5 | Threaded comments on forum posts                                                                                                             |
| FR-FORUM-6 | Single **Like** reaction on posts/comments (no emoji picker)                                                                                 |
| FR-FORUM-7 | Changes to forum posts/comments are tracked in an audit trail                                                                                |

### 2.5 Dashboard

| ID        | Requirement                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| FR-DASH-1 | Displays document stats (by category, extension, recent activity)                                           |
| FR-DASH-2 | Displays forum activity summary (recent posts, most active categories)                                      |
| FR-DASH-3 | Displays chat summary (unread conversations count)                                                          |
| FR-DASH-4 | Widgets are gated by the viewing user's permission claims (don't show data the user can't otherwise access) |
| FR-DASH-5 | Charts/visualizations (not just tables) for at least document and forum stats                               |

---

## 3. Non-Functional Requirements

| ID    | Category                   | Requirement                                                                                                                                                                         |
| ----- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-1 | Security                   | Passwords hashed (bcrypt/argon2); JWTs signed, short-lived access token + refresh token rotation                                                                                    |
| NFR-2 | Security                   | All file uploads validated (type/size) and stored outside the web root / via object storage                                                                                         |
| NFR-3 | Performance                | API responses for list endpoints paginated; target <300ms p95 for standard CRUD calls on seeded dev data                                                                            |
| NFR-4 | Scalability (design-level) | Real-time layer (Socket.io) designed so it could be moved behind a Redis adapter for horizontal scaling (not required to implement multi-instance for MVP)                          |
| NFR-5 | Usability                  | Responsive UI (desktop + tablet at minimum)                                                                                                                                         |
| NFR-6 | Maintainability            | TypeScript strict mode on both frontend and backend; **Oxlint** (Rust-based, 50-100x faster than ESLint, 700+ built-in rules incl. React/hooks/import/jsx-a11y) + Prettier enforced |
| NFR-7 | Testability                | Backend: unit tests for services/controllers; integration tests for auth & permission middleware. Frontend: component tests for critical flows                                      |
| NFR-8 | Observability              | Structured logging (e.g., pino/winston) on the backend; basic error boundaries on the frontend                                                                                      |
| NFR-9 | Documentation              | OpenAPI/Swagger spec or Postman collection for all endpoints; README with setup instructions                                                                                        |

---

## 4. Sample User Stories

- _As an Admin, I want to create a "Tech Support" role with document-category and chat-moderation claims, so I can delegate access without granting full admin rights._
- _As an Employee, I want to upload a document to a shared category, so my team can access it based on their role._
- _As a document owner, I want to share a specific sensitive document with one extra colleague outside their role's default access, so I don't have to change the whole category's permissions._
- _As any authenticated user, I want to start a group chat with my project team, so we can discuss without cluttering email._
- _As a Moderator, I want to delete an inappropriate forum comment, so the community space stays professional._
- _As an Admin, I want a dashboard overview of document and forum activity, so I can spot usage patterns at a glance._

---

## 5. Decisions (resolved)

1. **Guest/public forum browsing:** Not included. All features require authentication for Increment 1 — simplifies the auth model and route guarding. Public-facing pages may return in a later increment.
2. **Document categories:** Flat (no nesting) for Increment 1.
3. **File storage:** Local disk storage for Increment 1, behind a storage-service abstraction (a thin interface, e.g. `StorageService.save()/get()/delete()`) so swapping in S3/MinIO in a later increment is a config change, not a rewrite. This keeps MVP scope simple while still demonstrating forward-looking architecture.

---

_End of Document 2 — Requirements Analysis_
