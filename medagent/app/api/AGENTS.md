<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-25 | Updated: 2026-04-25 -->

# api

## Purpose
Next.js API routes implementing the MedAgent REST API. Handles access requests, session management, audit retrieval, patient data, and demo utilities.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `access/` | Access control endpoints — request, approve, session management |
| `audit/` | Audit trail endpoints — per-patient audit event retrieval |
| `patients/` | Patient data endpoints — list and individual patient lookup |
| `demo/` | Demo helper endpoints — readiness checks and simulated approvals |

## API Routes

| Method | Route | File | Purpose |
|--------|-------|------|---------|
| POST | `/api/access/request` | `access/request/route.ts` | Submit a new access request (triggers agent workflow) |
| GET | `/api/access/request/[id]` | `access/request/[id]/route.ts` | Poll request status by ID |
| POST | `/api/access/approve` | `access/approve/route.ts` | Patient approves a Tier 2 request |
| GET | `/api/access/session/[id]` | `access/session/[id]/chat/route.ts` | Session follow-up chat |
| GET | `/api/audit/[patientId]` | `audit/[patientId]/route.ts` | Fetch audit events for a patient |
| GET | `/api/patients` | `patients/route.ts` | List all patients |
| GET | `/api/patients/[id]` | `patients/[id]/route.ts` | Get individual patient details |
| GET | `/api/demo/readiness` | `demo/readiness/route.ts` | Check demo environment readiness |
| POST | `/api/demo/send-approval` | `demo/send-approval/route.ts` | Simulate patient approval for demos |

## For AI Agents

### Working In This Directory
- Each route file exports HTTP method handlers (`GET`, `POST`, etc.)
- Use `NextRequest`/`NextResponse` from `next/server`
- Access control logic delegates to `lib/agent/` — routes are thin wrappers
- Never return PHI in error responses

### Testing Requirements
- API routes are tested via integration tests in `../../tests/`
- `npm run build` validates route compilation

<!-- MANUAL: -->
