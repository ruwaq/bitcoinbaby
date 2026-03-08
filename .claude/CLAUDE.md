# CLAUDE.md

BitcoinBaby: Gamified mining ecosystem on Bitcoin using Proof of Useful Work (PoUW). Users "raise" digital babies by performing AI tasks. Built with BitcoinOS and Charms protocol.

**Visual:** Pixel Art 8-bit (NES/SNES) - see `rules/pixel-art.md`

## Commands

```bash
# Development
pnpm dev                                    # All packages
pnpm dev --filter @bitcoinbaby/web          # Web only
pnpm dev:pwa                                # PWA mode

# Build & Quality
pnpm build                                  # Build all
pnpm typecheck                              # Type check
pnpm lint && pnpm format                    # Lint + format

# Testing
pnpm test                                   # All tests
pnpm test --filter @bitcoinbaby/bitcoin     # Single package

# Dependencies
pnpm add <pkg> --filter @bitcoinbaby/core   # Add to package
pnpm add @bitcoinbaby/ui --filter @bitcoinbaby/web --workspace

# Mobile
pnpm --filter @bitcoinbaby/web cap:sync     # Sync native
pnpm --filter @bitcoinbaby/web cap:run:ios  # iOS
```

## Architecture

```
@bitcoinbaby/web ─┬─> @bitcoinbaby/ui
                  ├─> @bitcoinbaby/core ──> @bitcoinbaby/bitcoin
                  └─> @bitcoinbaby/ai (optional)
```

### Mining (`packages/core/src/mining/`)
- `orchestrator.ts` - CPU/WebGPU coordination, throttling
- `cpu-miner.ts` - SHA-256 in Web Workers
- `webgpu-miner.ts` - GPU acceleration
- `ai-integration.ts` - PoUW tasks

### Charms (`packages/bitcoin/src/charms/`)
- `token.ts` - $BABTC token
- `nft.ts` - Genesis Babies NFTs
- `prover.ts` - ZK proofs
- Spell versions: V9 (PoW Direct), V10 (Merkle Proofs)

### Stores (`packages/core/src/stores/`)
Zustand with persistence: `mining-store`, `wallet-store`, `nft-store`, `baby-store`

## Code Style

- TypeScript strict, ES modules, 2 spaces
- `interface` over `type` for objects
- Server Components default, `'use client'` when needed
- Tests colocated (`*.test.ts`)

## Git

- Branches: `feature/`, `fix/`, `docs/`
- Commits: `type(scope): description` (neutrales, sin firmas ni Co-Authored-By)
- Never commit `.env`
