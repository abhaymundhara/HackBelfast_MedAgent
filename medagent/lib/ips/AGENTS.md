<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-25 | Updated: 2026-04-25 -->

# ips

## Purpose
International Patient Summary (IPS) layer — defines the patient health record schema and provides seed data for demos. Models a FHIR-inspired structure for allergies, medications, conditions, and emergency contacts.

## Key Files

| File | Description |
|------|-------------|
| `schema.ts` | IPS data model — TypeScript types for patient records, medications, allergies, conditions |
| `seed.ts` | Demo seed data — pre-built patient summaries for hackathon demos |

## For AI Agents

### Working In This Directory
- Schema changes affect what data the agent can retrieve and display
- Seed data must stay realistic but contain no real PHI
- Used by `scripts/seed-demo.ts` and the retrieval pipeline

<!-- MANUAL: -->
