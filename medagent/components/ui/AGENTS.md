<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-25 | Updated: 2026-04-25 -->

# ui

## Purpose
shadcn/ui primitive components — generated via the shadcn CLI and customized with Tailwind. These are generic, reusable building blocks.

## Key Files

| File | Description |
|------|-------------|
| `button.tsx` | Button component with variants (default, destructive, outline, etc.) |
| `card.tsx` | Card container with header, content, footer sections |
| `dialog.tsx` | Modal dialog (Radix UI) |
| `toast.tsx` | Toast notification component |
| `toaster.tsx` | Toast notification container/provider |
| `input.tsx` | Text input |
| `textarea.tsx` | Multi-line text input |
| `table.tsx` | Data table components |
| `tabs.tsx` | Tab navigation (Radix UI) |
| `badge.tsx` | Status badge |
| `alert.tsx` | Alert/callout box |
| `separator.tsx` | Visual separator line |
| `switch.tsx` | Toggle switch (Radix UI) |

## For AI Agents

### Working In This Directory
- These are shadcn/ui components — prefer adding new ones via `npx shadcn-ui@latest add <component>`
- Modify existing components sparingly; customizations may be overwritten on regeneration
- Uses `class-variance-authority` for variant styling and `tailwind-merge` for class merging
- Import pattern: `import { Button } from "@/components/ui/button"`

<!-- MANUAL: -->
