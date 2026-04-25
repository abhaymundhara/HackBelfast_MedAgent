<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-25 | Updated: 2026-04-25 -->

# app (components)

## Purpose
MedAgent-specific React components implementing product features — clinician console, patient approval UI, session management, and status indicators.

## Key Files

| File | Description |
|------|-------------|
| `clinician-console.tsx` | Main clinician request form and response display |
| `approval-controls.tsx` | Patient approval/denial UI for Tier 2 requests |
| `session-follow-up.tsx` | Follow-up chat interface within an active session |
| `countdown.tsx` | Session token expiry countdown timer |
| `navbar.tsx` | App navigation bar |
| `patient-registration-form.tsx` | Patient onboarding form |
| `solana-status-alert.tsx` | Solana connection status indicator |
| `tier-badge.tsx` | Visual badge showing access tier (1/2/3/Denied) |

## For AI Agents

### Working In This Directory
- Components are `"use client"` — they use React hooks and browser APIs
- Import UI primitives from `../ui/` (Button, Card, Dialog, etc.)
- Follow camelCase naming for props and state
- Each component is self-contained in a single file

### Testing Requirements
- Verify visually via `npm run dev` and the demo flow
- `npm run build` catches type and SSR errors

<!-- MANUAL: -->
