# WEVSOCIAL Super-App Kernel & Platform

A production-grade, highly resilient Super-App architecture hosting sandboxed mini-apps with strict capability boundaries, deterministic geo-privacy obfuscation, offline-first transactional queueing, and self-hosted PostgreSQL infrastructure.

---

## Architecture Overview

```
                                  +---------------------------------------+
                                  |         Host Native Shell             |
                                  |  (MiniAppRegistry, Auth, SyncEngine)  |
                                  +-------------------+-------------------+
                                                      |
                    +---------------------------------+---------------------------------+
                    |                                 |                                 |
        +-----------v-----------+         +-----------v-----------+         +-----------v-----------+
        |   wev.sports MiniApp  |         |    wev.care MiniApp   |         |   wev.events MiniApp  |
        | - Activity Discovery  |         | - Geo-Privacy Bookings|         | - Scalability Stub    |
        | - Offline Booking     |         | - Address Reveal Logic|         +-----------------------+
        | - 409 Conflict Sim    |         | - Handoff Listener    |
        +-----------+-----------+         +-----------+-----------+
                    |                                 |
                    +---------------------------------+
                                      |
                     +----------------v----------------+
                     |   Capability Boundary SDK       |
                     |  (wev.auth, wev.storage,        |
                     |   wev.bridge, wev.permissions)  |
                     +----------------+----------------+
                                      |
                     +----------------v----------------+
                     |    Typed Repository Layer       |
                     |  (SportsRepo, CareRepo, Auth)   |
                     +----------------+----------------+
                                      |
                     +----------------v----------------+
                     |   Self-Hosted Backend Engine    |
                     |  (Fastify/Express, JWT, RBAC)   |
                     +----------------+----------------+
                                      |
                     +----------------v----------------+
                     |     PostgreSQL Database         |
                     +---------------------------------+
```

---

## Key Architectural Guarantees

1. **100% Strict TypeScript:** Zero `any` types across the entire codebase (`unknown` + type guards + schema validation).
2. **Capability Boundary & Sandboxing:** Mini-apps can never touch host state or global storage directly. All native capabilities are gated behind the injected `wev.*` SDK with runtime permission checks.
3. **Deterministic Geo-Privacy:** Exact provider coordinates and street addresses **never leave the backend** until a booking is definitively `CONFIRMED`. Public discovery uses deterministic 500m seed hashing.
4. **Offline-First State Machine:** Transactional queueing (`IDLE -> QUEUED -> SYNCING -> SUCCESS | CONFLICT_REJECTED`) with automatic reconnection replay and atomic 409 rollback.
5. **Fault Isolation:** `MiniAppErrorBoundary` at mount point guarantees a crash in one mini-app never cascades to other mini-apps or the host.
6. **Zero-Code Scaling (N+1 Apps):** Registering a new mini-app requires 0 modifications to existing mini-apps and 0 changes to the host shell.

---

## Getting Started

### Prerequisites
- Node.js 18+ (tested on Node v20/v24)
- Docker & Docker Compose (optional for containerized deployment)

### 1. Run the Backend & Database with Docker
```bash
docker-compose up --build
```
This stands up PostgreSQL 16 on port `5432` with auto-executed SQL migrations and launches the backend API on port `4000`.

### 2. Run Backend Locally (Zero-Setup In-Memory Mode)
If running without Docker, the backend automatically initializes with embedded relational storage and migrations:
```bash
cd backend
npm install
npm run dev
```

### 3. Run the Super-App
```bash
cd super-app
npm install
npm run web      # Run on Web
# or
npm run android  # Run on Android emulator/device
# or
npm run ios      # Run on iOS simulator
```

---

## Automated Verification & Test Suites

Run both comprehensive test suites across the backend and the super-app kernel:

```bash
# 1. Test Backend (Auth, JWT rotation, RBAC 403, Geo-Privacy <=500m, Concurrency & 409 Conflicts)
npm --prefix backend run typecheck
npm --prefix backend test

# 2. Test Super-App Kernel (Dynamic Registry, Sandboxed SDK, Scoped Storage, Bridge, Offline Queue)
npm --prefix super-app run typecheck
npm --prefix super-app test
```

---

## Phase Implementations

### Phase 0: Infrastructure & Backend
- `backend/docker-compose.yml` & `backend/Dockerfile`
- `backend/migrations/001_initial_schema.sql` & `backend/migrations/002_seed_data.sql`
- Fastify/Express API with bcrypt password hashing and JWT access/refresh token rotation.

### Phase 1: Mini-App Kernel & SDK Bridge
- `super-app/src/kernel/manifest.ts`: Manifest schema (`MiniAppManifest`).
- `super-app/src/kernel/registry.ts`: Runtime registry with dynamic discovery.
- `super-app/src/kernel/sdk/`: Injected `wev.*` capability boundary:
  - `wev.auth.getUser()`: Scoped user profile.
  - `wev.storage.get/set()`: Namespaced storage isolation (`__wev_app_${appId}__`).
  - `wev.nav.navigate()`: Coordinated navigation stack.
  - `wev.bridge.emit/on()`: Sandboxed inter-app event bus.
  - `wev.permissions.request()`: Pre-execution permission token validator.
- `super-app/src/kernel/error/MiniAppErrorBoundary.tsx`: Fault isolation boundary.

### Phase 2: Identity, Auth & RBAC
- Credential authentication with bcrypt password hashing.
- Token manager with automatic silent refresh on HTTP 401.
- Role-Based Access Control: Guests attempting to access admin APIs receive `HTTP 403 Forbidden`.
- Injected SDK blocks capability execution if permission scope is missing before network dispatch.

### Phase 3: Reference Mini-Apps
- **Sports Mini-App (`wev.sports`):** Activity browsing with 250+ item virtualization benchmark, booking flow, reproducible crash button, 409 double-booking simulator, and cross-app event emission.
- **Care Mini-App (`wev.care`):** Vetted provider booking with deterministic geo-obfuscation (500m jitter), address masked until confirmed, and cross-app handoff listener pre-filtering providers for sports session window.
- **Events Mini-App (`wev.events`):** Lightweight stub proving dynamic N+1 scalability in runtime registry.

### Phase 4: Offline-First Booking State Machine
- Strict state lifecycle: `IDLE -> QUEUED -> SYNCING -> SUCCESS | CONFLICT_REJECTED`.
- Optimistic UI ("Pending Sync") with background queue.
- Reconnection sync queue with automatic retry.
- 409 Conflict interceptor with optimistic state rollback and user alert.

### Phase 5: Performance & Design Tokens
- Standardized design tokens (`colors`, `typography`, `spacing`, `borderRadius`).
- Global dynamic Dark / Light theme.
- Virtualized list for >200 items.
- Interactive Kernel Debug Panel with real-time bridge logs, offline toggles, and RBAC testing.
