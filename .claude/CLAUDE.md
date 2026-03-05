# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BitcoinBaby is a gamified mining ecosystem on Bitcoin using Proof of Useful Work (PoUW). Users "raise" a digital baby by performing AI tasks that contribute to training a collective model. Built with BitcoinOS and Charms protocol.

**Visual Style:** Pixel Art 8-bit (NES/SNES aesthetic) - see `docs/PIXEL_ART_DESIGN.md`

## Commands

```bash
# Development
pnpm dev                           # Run all packages in parallel
pnpm dev --filter @bitcoinbaby/web # Run only web app
pnpm dev:pwa                       # Web with PWA/service worker (webpack)

# Build
pnpm build                         # Build all packages
pnpm build --filter @bitcoinbaby/core # Build single package

# Type checking & Linting
pnpm typecheck                     # Check types across all packages
pnpm lint                          # Lint all packages
pnpm format                        # Format with Prettier

# Testing
pnpm test                          # Run all tests (Vitest)
pnpm test --filter @bitcoinbaby/bitcoin  # Test single package
pnpm --filter @bitcoinbaby/web test -- --watch  # Watch mode
pnpm --filter @bitcoinbaby/bitcoin test:coverage # Coverage

# Dependencies
pnpm add <pkg> --filter @bitcoinbaby/core       # Add to package
pnpm add @bitcoinbaby/ui --filter @bitcoinbaby/web --workspace  # Add workspace dep

# Mobile (Capacitor)
pnpm --filter @bitcoinbaby/web cap:sync         # Sync native projects
pnpm --filter @bitcoinbaby/web cap:run:ios      # Build & run iOS
pnpm --filter @bitcoinbaby/web cap:run:android  # Build & run Android
```

## Architecture

### Package Dependencies

```
@bitcoinbaby/web ─────┬─> @bitcoinbaby/ui
                      ├─> @bitcoinbaby/core ──> @bitcoinbaby/bitcoin
                      ├─> @bitcoinbaby/bitcoin
                      └─> @bitcoinbaby/ai (optional)
```

### Mining System (`packages/core/src/mining/`)

The mining engine follows the BRO token pattern:
- `orchestrator.ts` - Coordinates CPU/WebGPU miners, handles battery/visibility throttling
- `cpu-miner.ts` - SHA-256 hashing in Web Workers
- `webgpu-miner.ts` - GPU-accelerated mining (when available)
- `ai-integration.ts` - AI PoUW task integration
- `client-vardiff.ts` - Client-side variable difficulty adjustment
- `persistence.ts` - Mining state persistence across sessions

### Charms Integration (`packages/bitcoin/src/charms/`)

Bitcoin smart contracts via Charms protocol:
- `token.ts` - $BABTC token (mining rewards, transfers)
- `nft.ts` - Genesis Babies NFTs with XP/evolution
- `prover.ts` - ZK proof generation client
- `minting-manager.ts` - Complete minting flow orchestration
- `balance.ts` - V10 balance queries via Scrolls API

Spell versions:
- V9: PoW Direct (current, CLI 0.11.1)
- V10: Merkle Proofs (newer)

### State Management (`packages/core/src/stores/`)

Zustand stores with persistence:
- `mining-store.ts` - Mining session stats, hashrate
- `wallet-store.ts` - Wallet connection state
- `nft-store.ts` - NFT boost calculations (single source of truth)
- `baby-store.ts` - Baby state, evolution, XP

### Key Hooks (`packages/core/src/hooks/`)

- `useGlobalMining.ts` - Main mining hook (combines store + orchestrator)
- `useCharms.ts` - Charms transaction building
- `useWalletProvider.ts` - Multi-wallet support (UniSat, Xverse, internal)

## Code Style

- TypeScript strict mode, ES modules only
- 2 spaces indentation, Prettier formatting
- `interface` over `type` for objects
- Server Components by default, `'use client'` only when needed
- Tests colocated (`*.test.ts`)

### Pixel Art UI Requirements

All UI must follow 8-bit aesthetic:
```css
--font-pixel: 'Press Start 2P';      /* Titles */
--font-pixel-body: 'Pixelify Sans';  /* Body text */
--pixel-primary: #f7931a;            /* Bitcoin Gold */
--pixel-secondary: #4fc3f7;          /* Baby Blue */
--pixel-bg-dark: #0f0f1b;            /* Background */
```

Use `image-rendering: pixelated`, hard-edge borders (no rounded corners), `steps()` animations.

## Blockchain Security

- NEVER log private keys or hardcode secrets
- Always validate addresses before transactions
- Use testnet for development (`bitcoin.networks.testnet`)
- Verify balance before building transactions
- Clean sensitive data from memory after use

## Git Workflow

- Branches: `feature/`, `fix/`, `docs/`
- Commits: `type(scope): description`
- PRs require CI green
- Never commit `.env` files
