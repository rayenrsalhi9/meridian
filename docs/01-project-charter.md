# Project Charter — Meridian
**Document 1 of the SDLC series — Planning Phase**
**Increment:** 1 (MVP)
**Methodology:** Incremental & Iterative Development
**Author / Role:** Solo developer acting as PM, BA, Architect, Developer, QA

---

## 1. Background

This project is a from-scratch rebuild of an existing final-year academic project (originally: Laravel 9 + Angular 12 enterprise intranet with document management, forums, chat, blogs, surveys, reminders, and an n8n-based AI forum agent).

The rebuild is not a port — it is a re-architected system using a stack the author is proficient in, developed as a solo, resume-grade portfolio project following full professional SDLC practices.

## 2. Vision Statement

> Build a modern, production-quality enterprise intranet MVP — centered on document management, real-time collaboration, and community forums — using an incremental, iterative methodology, with each increment shipped as a complete, working, demoable product.

## 3. Goals & Objectives

- **Showcase**: Demonstrate full-stack engineering competence (architecture, API design, database design, real-time systems, security/RBAC, UI/UX) to technical recruiters and interviewers.
- **Learn**: Deepen practical expertise in the React + TypeScript + Express + TypeScript + PostgreSQL/Prisma stack, and in real-time systems (WebSockets).
- **Deliver**: A working, deployed, demoable MVP within a few weeks, followed by additional increments (e.g., an AI-powered forum agent, notifications) built as separate cycles on a stable foundation.

## 4. Scope

### 4.1 In Scope — Increment 1 (MVP)

| # | Feature | Rationale for inclusion |
|---|---|---|
| 1 | **Authentication & RBAC** | Foundational; demonstrates JWT auth, role/permission-based access control |
| 2 | **Document Management System** | Flagship feature — file upload/preview/permissions/versioning/audit trail; highest complexity and visual impact |
| 3 | **Real-time Chat** | 1-on-1 + group messaging via WebSockets (Socket.io); demonstrates real-time architecture |
| 4 | **Forums** | Categories, posts, threaded comments, reactions; demonstrates relational data modeling and moderation/permission logic |
| 5 | **Dashboard** | Aggregates stats/widgets across the other features; demonstrates data visualization and cohesive product thinking |

### 4.2 Explicitly Out of Scope for Increment 1 (deferred to later increments)

- AI-powered forum agent (planned as a dedicated later increment, built natively rather than via n8n)
- Blogs, Articles, Surveys, Reminders, Calendar
- Notifications center (candidate for Increment 1.5 / early Increment 2 since it reuses chat's socket infrastructure)
- Multi-language (i18n) support
- Company/settings configuration panel
- Public-facing marketing pages beyond a minimal landing page

### 4.3 Assumptions & Constraints

- Solo development; no external stakeholders to consult, but the process will simulate professional documentation and sign-off gates for portfolio value.
- Timeline: tight MVP, target a few weeks of active work.
- Deployment platform decision deferred to a later planning checkpoint (post-design).

## 5. Technology Stack (confirmed)

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript |
| Routing | React Router (SPA) |
| Backend | Express + TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Real-time | Socket.io (WebSockets) |
| UI Components | shadcn/ui, scaffolded with Efferd / shadcnblocks blocks, customized |
| Deployment | TBD |
| Dev OS | Ubuntu |
| Version Control | Git, hosted on GitHub |
| IDE | VS Code |
| AI coding tool | OpenCode |
| Code review | CodeRabbit (automated PR review on GitHub) |

## 6. Development Methodology

**Incremental & Iterative Model.** Each increment is a complete mini-SDLC cycle:

```
Plan → Requirements → Design → Implementation → Testing → Deployment → Review
```

Increment 1 delivers a working, deployed system covering the 5 core features above. Subsequent increments (e.g., Increment 2: AI Forum Agent + Notifications) begin their own planning phase only after Increment 1 is functionally complete and deployed — ensuring each stage of the portfolio shows a *working system*, not a perpetually half-finished one.

## 7. Success Criteria / Definition of Done (Increment 1)

- All 5 core features functionally complete and manually tested
- Auth & RBAC enforced across all protected routes/endpoints
- Real-time chat functioning between at least 2 concurrent users
- Documented API (e.g., OpenAPI/Swagger or Postman collection)
- Database schema diagram produced and matches implementation
- Codebase includes README, setup instructions, and architecture diagram
- Application deployed and reachable via a public URL (or fully documented local Docker setup if deployment is deferred)

## 8. Risks

| Risk | Mitigation |
|---|---|
| Scope creep (re-adding cut features) | Strict adherence to this charter; new ideas logged for future increments, not pulled into Increment 1 |
| Solo dev time constraints vs. "few weeks" target | Feature list already trimmed to 5; each has clear MVP-level acceptance criteria (see Requirements doc, next) |
| Real-time chat complexity underestimated | Time-box a spike/prototype early in Design phase before committing to final architecture |
| UI blocks (Efferd/shadcnblocks) looking generic/templated | Explicit re-theming pass planned during Design phase (colors, typography, spacing) |

## 9. Next Step

Proceed to **Phase 2: Requirements Analysis** — produce functional & non-functional requirements and user stories/personas for each of the 5 in-scope features.

---
*End of Document 1 — Project Charter*
