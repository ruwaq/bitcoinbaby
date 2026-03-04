# Workers Deployment Tracking

## Current Production Version

| Version ID | Date | Description |
|------------|------|-------------|
| `d4a1964d-ee22-430e-9623-33aa12ef8c87` | 2026-03-04 | Fix API validation schema mismatch |

## Deployment History

| Version ID | Date | Description |
|------------|------|-------------|
| `d4a1964d-ee22-430e-9623-33aa12ef8c87` | 2026-03-04 13:52 UTC | Fix: Remove `{ proof }` wrapper, use timestamp instead of reward |
| `95137d20-aece-4e77-9847-84385d7ea65e` | 2026-03-04 12:55 UTC | Fix: Extended MAX_PROOF_AGE_MS to 2 hours, relaxed VarDiff enforcement |
| `22077ef3-5769-4832-81c8-7084f1b8bc05` | 2026-03-03 19:07 UTC | Previous stable version |

## How to Deploy

```bash
# Production
pnpm run deploy:production

# Check current deployment
pnpm exec wrangler deployments list --env production | tail -20
```

## Rollback

To rollback to a previous version:
```bash
pnpm exec wrangler rollback --env production
```
