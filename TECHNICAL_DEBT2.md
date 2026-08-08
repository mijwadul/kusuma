# Technical Debt - PT. Kusuma Samudera Berkah

This document tracks known technical debt, improvements needed, and optimization opportunities for the Kusuma management system.

**Last Updated:** August 2026  
**Status:** Active Development

---

## 📋 Overview

This monorepo contains three main components:
- **Backend**: FastAPI (Python)
- **Frontend**: React + TypeScript + Vite
- **Mobile**: Android (Kotlin + Jetpack Compose)

Below are categorized issues organized by priority and component.

---

## 🔴 HIGH PRIORITY

### 1. **Missing Docker Configuration**
- **Component**: Root
- **Issue**: `docker-compose.yml` referenced in README but file does not exist in repository
- **Impact**: Users cannot quickly spin up the entire system locally
- **Status**: NOT STARTED
- **Action Items**:
  - [ ] Create `docker-compose.yml` with services for backend, frontend, database (PostgreSQL/MySQL)
  - [ ] Add environment configuration examples
  - [ ] Test full stack startup with Docker Compose
- **Estimated Effort**: 4-6 hours

### 2. **Unpinned Dependencies - Backend**
- **Component**: Backend (`requirements.txt`)
- **Issue**: Dependencies lack version constraints (e.g., `fastapi`, `sqlalchemy`, `uvicorn`), causing reproducibility issues
- **Current State**:
  ```
  fastapi              # No version pinned
  uvicorn[standard]    # No version pinned
  sqlalchemy           # No version pinned
  ```
- **Impact**: 
  - Build inconsistency across environments
  - Unexpected breaking changes in production
  - Security vulnerabilities from outdated packages
- **Status**: NOT STARTED
- **Action Items**:
  - [ ] Audit all dependencies for latest stable versions
  - [ ] Pin to specific versions (e.g., `fastapi>=0.100.0,<0.110.0`)
  - [ ] Separate dev dependencies into `requirements-dev.txt`
  - [ ] Test full application with pinned versions
  - [ ] Document Python version requirement (stated as 3.10+)
- **Estimated Effort**: 3-4 hours

### 3. **Duplicate Dependencies - Backend**
- **Component**: Backend (`requirements.txt`)
- **Issue**: `python-multipart` listed twice (line 25 and line 36)
- **Status**: NOT STARTED
- **Action Items**:
  - [ ] Remove duplicate entry
  - [ ] Consolidate utilities section
- **Estimated Effort**: 0.5 hours

### 4. **Outdated Build Tools - Frontend**
- **Component**: Frontend
- **Issue**: Multiple build & tooling dependencies are outdated:
  - `vite: 8.0.13` (should be v5+)
  - `typescript: 5.2.2` (should be 5.3+)
  - Other dev dependencies may have security patches
- **Impact**: 
  - Potential security vulnerabilities
  - Missing performance improvements
  - Loss of community support
- **Status**: NOT STARTED
- **Action Items**:
  - [ ] Audit `package.json` for outdated packages
  - [ ] Update Vite to latest v5.x
  - [ ] Update TypeScript to 5.4+
  - [ ] Run `npm audit` and fix vulnerabilities
  - [ ] Test build and dev server after updates
  - [ ] Update `package-lock.json`
- **Estimated Effort**: 3-5 hours

### 5. **Missing CI/CD Pipeline**
- **Component**: GitHub Actions
- **Issue**: No automated testing, linting, or deployment workflows
- **Impact**: 
  - No code quality enforcement
  - Manual deployment risk
  - No automated test runs before merge
- **Status**: NOT STARTED
- **Action Items**:
  - [ ] Create `.github/workflows/backend-test.yml` - Run pytest, type checks
  - [ ] Create `.github/workflows/frontend-test.yml` - Run ESLint, build verification
  - [ ] Create `.github/workflows/security.yml` - Dependency scanning, vulnerability checks
  - [ ] Add branch protection rules requiring passing checks
  - [ ] Document CI/CD setup in CONTRIBUTING.md
- **Estimated Effort**: 6-8 hours

---

## 🟠 MEDIUM PRIORITY

### 6. **Missing Frontend Linting & Formatting**
- **Component**: Frontend
- **Issue**: No ESLint, Prettier, or equivalent code quality tools configured
- **Impact**: 
  - Inconsistent code style
  - Potential bugs from unused variables (noUnusedLocals configured but not enforced)
  - No auto-formatting on save
- **Status**: NOT STARTED
- **Action Items**:
  - [ ] Install `eslint` and `@typescript-eslint/*`
  - [ ] Install and configure `prettier`
  - [ ] Create `.eslintrc.json` and `.prettierrc`
  - [ ] Add npm scripts: `lint`, `lint:fix`, `format`
  - [ ] Update package.json with scripts
  - [ ] Add pre-commit hook via husky if desired
- **Estimated Effort**: 2-3 hours

### 7. **Backend Architecture - Mixed Concerns**
- **Component**: Backend (`backend/app/main.py`)
- **Issue**: Main.py mixes concerns:
  - Framework initialization (CORS, middleware, error handlers)
  - Database bootstrap logic
  - Scheduler setup
  - Router includes (18+ routers registered)
  - Global exception handling
- **Impact**: 
  - Hard to test
  - Difficult to maintain
  - Makes startup logic unclear
- **Status**: NOT STARTED
- **Action Items**:
  - [ ] Extract database bootstrap to `core/bootstrap.py`
  - [ ] Extract scheduler to separate module with clear lifecycle
  - [ ] Extract exception handlers to `core/exception_handlers.py`
  - [ ] Consider router factory pattern to organize includes
  - [ ] Move middleware setup to `core/middleware.py`
  - [ ] Add detailed comments explaining startup order
- **Estimated Effort**: 4-5 hours

### 8. **Missing API Documentation**
- **Component**: Backend
- **Issue**: No OpenAPI/Swagger documentation setup in FastAPI
- **Current**: FastAPI provides automatic docs but not explicitly documented in README
- **Impact**: 
  - Frontend developers can't easily discover endpoints
  - No centralized API contract documentation
- **Status**: PARTIALLY IMPLEMENTED
- **Action Items**:
  - [ ] Ensure FastAPI auto-docs are accessible at `/docs` (should be automatic)
  - [ ] Document endpoint descriptions in route docstrings
  - [ ] Add request/response schema documentation
  - [ ] Link to Swagger docs in README
  - [ ] Consider postman/insomnia collection export
- **Estimated Effort**: 2-3 hours

### 9. **Missing Architecture Documentation**
- **Component**: Root
- **Issue**: Complex division-based architecture not formally documented
- **README states**: Multi-divisi system with 4 divisions but no architecture diagrams or data flow
- **Status**: NOT STARTED
- **Action Items**:
  - [ ] Create `ARCHITECTURE.md` with:
    - System overview diagram
    - Division-based architecture explanation
    - Data flow between services
    - Role & permission hierarchy
    - Database schema overview
  - [ ] Add sequence diagrams for key flows (auth, approval workflows)
  - [ ] Document service boundaries
- **Estimated Effort**: 4-6 hours

### 10. **No Automated Testing Infrastructure**
- **Component**: Backend & Frontend
- **Issue**: `pytest` in requirements but no test suite visible; frontend has no test setup
- **Impact**: 
  - No regression prevention
  - Manual testing required
  - Hard to refactor safely
- **Status**: NOT STARTED
- **Action Items**:
  - [ ] Create `backend/tests/` directory structure
  - [ ] Add conftest.py with fixtures and database setup
  - [ ] Write unit tests for core services (auth, permissions)
  - [ ] Write integration tests for API endpoints
  - [ ] Achieve >70% code coverage
  - [ ] Setup Jest/Vitest for frontend
  - [ ] Write component tests for critical UI
  - [ ] Add test coverage reporting
- **Estimated Effort**: 12-16 hours

### 11. **Backend Exception Handling - Print to Console**
- **Component**: Backend (`backend/app/main.py`, lines 118-119)
- **Issue**: Global exception handler prints errors to console instead of logging
  ```python
  print(f"ERROR: {exc}")
  print(f"TRACEBACK: {traceback_str}")
  ```
- **Impact**: 
  - Errors not persisted in production
  - No centralized error tracking
  - Difficult to debug issues post-deployment
- **Status**: NOT STARTED
- **Action Items**:
  - [ ] Integrate structured logging (e.g., `structlog`, `loguru`, or `python-json-logger`)
  - [ ] Replace `print()` calls with logger
  - [ ] Add log level configuration in settings
  - [ ] Setup log aggregation (if deploying to production)
  - [ ] Add request ID tracking for debugging
- **Estimated Effort**: 2-3 hours

### 12. **Missing Environment Variable Documentation**
- **Component**: Backend & Frontend
- **Issue**: README says to create `.env` manually but doesn't provide template or list of required vars
- **Impact**: 
  - New developers unsure what to configure
  - Errors from missing env vars
- **Status**: NOT STARTED
- **Action Items**:
  - [ ] Create `.env.example` in backend and frontend
  - [ ] List all required environment variables
  - [ ] Add descriptions and default values
  - [ ] Document which are optional
  - [ ] Update README to reference `.env.example`
- **Estimated Effort**: 1-2 hours

---

## 🟡 MEDIUM-LOW PRIORITY

### 13. **Monorepo Organization**
- **Component**: Root
- **Issue**: Backend, frontend, and Android are in single repo but lack clear workspace configuration
- **Impact**: 
  - Harder to manage CI/CD per component
  - Dependency conflicts possible
  - Unclear which root-level config applies where
- **Status**: NOT STARTED
- **Action Items**:
  - [ ] Consider migrating to pnpm workspaces or monorepo tool
  - [ ] Add root-level `package.json` with workspace definition
  - [ ] Document monorepo structure in CONTRIBUTING.md
  - [ ] Add scripts to run tests, lint for all components
- **Estimated Effort**: 3-4 hours (optional, depends on growth)

### 14. **Vite Configuration - Minimal**
- **Component**: Frontend (`vite.config.ts`)
- **Issue**: Very basic config; missing important optimizations
- **Current**:
  ```typescript
  export default defineConfig({
    plugins: [react()],
    server: { port: 5173, open: true, proxy: { ... } },
  })
  ```
- **Missing**:
  - Build optimization (chunk size, lazy loading)
  - Environment variable injection
  - Source map handling
  - Alias path configuration
- **Status**: NOT STARTED
- **Action Items**:
  - [ ] Add build optimization settings
  - [ ] Add environment-based configuration
  - [ ] Configure path aliases for cleaner imports
  - [ ] Add source maps for dev, disable for prod
  - [ ] Document build output size
- **Estimated Effort**: 1-2 hours

### 15. **React Router - All Routes at Top Level**
- **Component**: Frontend (`frontend/src/App.tsx`)
- **Issue**: All 30+ routes defined in single App.tsx; hard to maintain
- **Impact**: 
  - Large file (127 lines)
  - Difficult to add new routes
  - Hard to trace flow
- **Status**: NOT STARTED
- **Action Items**:
  - [ ] Extract routes to `src/routes/` directory
  - [ ] Group routes by feature (auth, dashboard, equipment, etc.)
  - [ ] Use route factory pattern for cleaner config
  - [ ] Create centralized route definitions
  - [ ] Document route structure
- **Estimated Effort**: 2-3 hours

### 16. **Frontend Type Safety - Loose Typing**
- **Component**: Frontend
- **Issue**: While TypeScript is configured with `strict: true`, API response types may not be fully defined
- **Missing**: 
  - Generated types from OpenAPI/backend schema
  - Type definitions for all API endpoints
- **Status**: NOT STARTED
- **Action Items**:
  - [ ] Audit `src/types/` directory for completeness
  - [ ] Consider using code generation from backend OpenAPI spec
  - [ ] Add strict typing for all API calls
  - [ ] Document type conventions
- **Estimated Effort**: 3-4 hours

### 17. **Scheduler Implementation - No Persistence**
- **Component**: Backend (`core/scheduler.py`)
- **Issue**: APScheduler running in-memory; no persistence of scheduled jobs
- **Impact**: 
  - Jobs lost if service restarts
  - Can't verify scheduled jobs across restarts
- **Status**: NOT STARTED
- **Action Items**:
  - [ ] Integrate APScheduler with persistent backend (DB or Redis)
  - [ ] Add health check endpoint for scheduler status
  - [ ] Document scheduled jobs and their purposes
  - [ ] Add monitoring/alerting for failed jobs
- **Estimated Effort**: 2-3 hours

---

## 🟢 LOW PRIORITY

### 18. **README - Outdated Reference**
- **Component**: Root (`README.md`)
- **Issue**: References `TECHNICAL_DEBT.md` (line 89) but file didn't exist until now
- **Status**: RESOLVED
- **Action Items**:
  - [x] Create `TECHNICAL_DEBT.md`

### 19. **Android Documentation**
- **Component**: Android
- **Issue**: README mentions Android app but no details; referenced documentation appears incomplete
- **Current**: "Detail lebih lanjut dapat dilihat di `Android/README.md`"
- **Status**: NOT STARTED
- **Action Items**:
  - [ ] Verify `Android/README.md` exists and is complete
  - [ ] Document build and deployment process
  - [ ] Add signing key configuration instructions
  - [ ] Document Firebase/Google services setup if needed

### 20. **Code Comments & Docstrings**
- **Component**: Backend & Frontend
- **Issue**: Limited inline documentation of complex logic
- **Impact**: 
  - Harder for new contributors to understand codebase
  - Complex division logic not explained
- **Status**: NOT STARTED
- **Action Items**:
  - [ ] Add docstrings to all services and utilities
  - [ ] Document division-based authorization logic
  - [ ] Add comments for complex algorithms
  - [ ] Create ADR (Architecture Decision Records) for major patterns
- **Estimated Effort**: 4-6 hours

### 21. **Database Migrations - Version Control**
- **Component**: Backend (`backend/alembic/`)
- **Issue**: Alembic setup exists but migration history not documented
- **Status**: NOT STARTED
- **Action Items**:
  - [ ] Document migration naming convention
  - [ ] Add guidance for creating new migrations
  - [ ] Document rollback procedures
  - [ ] Add migration testing to CI/CD

### 22. **Error Handling - User-Friendly Messages**
- **Component**: Backend
- **Issue**: Global exception handler returns "Internal server error. Hubungi administrator" (line 121)
- **Status**: PARTIAL (needs improvement)
- **Action Items**:
  - [ ] Standardize error response format
  - [ ] Add error codes for frontend to display appropriate messages
  - [ ] Localize error messages (Indonesian/English)
  - [ ] Create error reference documentation

---

## 📊 Debt Summary

| Priority | Count | Est. Hours | Components |
|----------|-------|-----------|------------|
| 🔴 HIGH | 5 | 16-23 | Docker, Deps, CI/CD, Outdated Tools |
| 🟠 MEDIUM | 8 | 24-37 | Architecture, Testing, Linting, Logging |
| 🟡 MED-LOW | 4 | 6-12 | Code Organization, Config |
| 🟢 LOW | 5 | 8-12 | Docs, Comments, Migrations |
| **TOTAL** | **22** | **54-84 hours** | |

---

## 🚀 Quick Wins (1-2 hour fixes)

1. ✅ Add `TECHNICAL_DEBT.md` - DONE
2. Remove duplicate `python-multipart` dependency
3. Create `.env.example` files
4. Add project-level `.gitignore` rules
5. Update README with Swagger docs link

---

## 📅 Recommended Implementation Order

### Phase 1: Foundation (Weeks 1-2)
- [ ] Fix duplicate dependencies
- [ ] Pin all backend dependencies
- [ ] Create Docker configuration
- [ ] Add `.env.example` files
- [ ] Setup CI/CD pipeline (GitHub Actions)

### Phase 2: Quality (Weeks 3-4)
- [ ] Add frontend linting (ESLint, Prettier)
- [ ] Update build tools (Vite, TypeScript)
- [ ] Implement structured logging
- [ ] Create architecture documentation

### Phase 3: Testing & Robustness (Weeks 5-6)
- [ ] Implement automated testing (backend)
- [ ] Implement automated testing (frontend)
- [ ] Refactor backend main.py
- [ ] API documentation (Swagger review)

### Phase 4: Enhancement (Ongoing)
- [ ] Improve error handling
- [ ] Code comments and docstrings
- [ ] Advanced monitoring
- [ ] Performance optimization

---

## 📝 Contributing

When addressing technical debt:

1. Create an issue from this document
2. Reference the issue in your PR
3. Update this file when closing items
4. Add new items as they're discovered

---

## 📞 Questions?

Refer to individual issues or create a discussion in the repository.

---

**Generated:** August 2026  
**Maintainer**: [@mijwadul](https://github.com/mijwadul)
