<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-25 | Updated: 2026-04-25 -->

# app

## Purpose
Next.js App Router directory containing all pages (UI) and API routes. Defines the clinician console, patient dashboard, audit viewer, and the REST API surface.

## Key Files

| File | Description |
|------|-------------|
| `layout.tsx` | Root layout — HTML shell, font loading, theme provider |
| `page.tsx` | Landing page |
| `globals.css` | Global Tailwind CSS styles |
| `favicon.ico` | App favicon |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `api/` | REST API routes — access control, audit, patients, demo helpers (see `api/AGENTS.md`) |
| `clinician/` | Clinician-facing pages — request console and active session view |
| `patient/` | Patient-facing pages — registration and approval dashboard |
| `audit/` | Audit trail viewer — per-patient audit timeline with Solscan links |

## For AI Agents

### Working In This Directory
- Pages use the `page.tsx` convention, API routes use `route.ts`
- Dynamic segments use `[param]` folder naming (e.g., `audit/[patientId]/page.tsx`)
- All pages are server components by default; add `"use client"` only when needed
- UI components live in `../components/`, not inline in pages

### Page Routes

| Route | File | Purpose |
|-------|------|---------|
| `/` | `page.tsx` | Landing page |
| `/clinician` | `clinician/page.tsx` | Clinician request console |
| `/clinician/session/[id]` | `clinician/session/[id]/page.tsx` | Active session with follow-up chat |
| `/patient` | `patient/page.tsx` | Patient registration/QR page |
| `/patient/dashboard` | `patient/dashboard/page.tsx` | Patient approval dashboard |
| `/audit/[patientId]` | `audit/[patientId]/page.tsx` | Audit trail for a specific patient |

### Testing Requirements
- API routes: tested via integration tests in `../tests/`
- Pages: verify visually via `npm run dev`
- Build check: `npm run build` catches SSR and type errors

<!-- MANUAL: -->
