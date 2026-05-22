# BitcoinBaby

> Proof of Useful Work mining ecosystem on Bitcoin

BitcoinBaby is a gamified mining platform where users "raise" a digital baby by performing AI tasks that contribute to training a collective model. Built on Bitcoin using BitcoinOS and Charms protocol.

## Architecture

```
bitcoinbaby/
├── apps/
│   ├── web/                # Next.js 16 (SSR + API Routes + Capacitor for mobile)
│   └── workers/            # Cloudflare Workers (Hono API + Durable Objects)
├── packages/
│   ├── ui/                 # Shared React components (Tailwind CSS v4)
│   ├── core/               # Business logic + Zustand stores
│   ├── bitcoin/            # bitcoinjs-lib + Charms SDK
│   ├── ai/                 # Transformers.js wrapper
│   ├── shared/             # Shared types, config, HTTP client, and validation
│   └── config/             # Shared ESLint, Tailwind, TypeScript
├── turbo.json
└── pnpm-workspace.yaml
```

**95%+ code shared** between web and mobile native targets since they are unified in `apps/web`.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | Turborepo + pnpm |
| Web | Next.js 16.2.6, React 19.2.3, Tailwind CSS v4, shadcn/ui |
| Mobile | Capacitor (static build wrapper inside apps/web) |
| Backend | Cloudflare Workers, Hono, Durable Objects, Redis |
| State | Zustand |
| Mining | Web Workers + WebGPU |
| Blockchain | Bitcoin (Testnet4/Mainnet), Charms, bitcoinjs-lib |
| AI | Transformers.js (WebGPU-accelerated text classification) |

## Quick Start

```bash
# Prerequisites
node --version  # >= 20.0.0
pnpm --version  # >= 9.0.0

# Install dependencies
pnpm install

# Development
pnpm dev

# Build
pnpm build

# Type check
pnpm typecheck
```

## Development

```bash
# Run only web app
pnpm dev --filter @bitcoinbaby/web

# Add dependency to a package
pnpm add zustand --filter @bitcoinbaby/core

# Add workspace dependency
pnpm add @bitcoinbaby/ui --filter @bitcoinbaby/web --workspace
```

## Documentation

| Document | Description |
|----------|-------------|
| [SETUP.md](./SETUP.md) | Step-by-step monorepo setup |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture details |
| [ROADMAP.md](./ROADMAP.md) | Development phases |
| [docs/TECH_COMPARISON.md](./docs/TECH_COMPARISON.md) | Technology decisions |
| [docs/TECHNICAL_DECISIONS.md](./docs/TECHNICAL_DECISIONS.md) | Technical rationale |

## Project Structure

### apps/web
Full Next.js 16 application with:
- App Router, React 19, and Tailwind CSS v4
- SSR + API Routes (web target deployed to Vercel)
- Integrated Capacitor setup for iOS/Android native targets (built via static export)
- Uses shared UI components, core mining loop, and Zustand stores

### apps/workers
Backend APIs running on Cloudflare Workers edge:
- Hono router for fast, edge-native endpoint execution
- Durable Objects to maintain real-time game rooms, withdraw pools, and virtual balances
- Redis (Upstash) for global mining leaderboard

### packages/core
Business logic shared across the project:
- Mining orchestrator (CPU/WebGPU) with variable difficulty support
- Game loop, Achievements, and Baby state decay logic
- Zustand stores for client-side state

### packages/ui
Design system and core reusable components:
- Tailwind CSS v4 utility classes
- shadcn/ui base primitives and layout elements
- class-variance-authority styling variants

### packages/bitcoin
Bitcoin and smart contract operations:
- Wallet generation (bip32, bip39 derivation)
- PSBT transaction building and atomic swaps
- Charms protocol integration (Inscriptions, UTXO validation)

### packages/shared
Single source of truth for the workspace:
- Shared TypeScript schemas and validation rules (Zod)
- Config values (env handling, game phases)
- Base HTTP Client and structured logging utilities

## Roadmap

1. **Phase 0:** Monorepo setup
2. **Phase 1:** Web app base (Next.js)
3. **Phase 2:** Shared packages
4. **Phase 3:** Wallet integration
5. **Phase 4:** Mining engine
6. **Phase 5:** Charms integration
7. **Phase 6:** Tamagotchi game
8. **Phase 7:** AI integration
9. **Phase 8:** Native app (Capacitor)
10. **Phase 9:** Native features
11. **Phase 10:** Mainnet launch

See [ROADMAP.md](./ROADMAP.md) for details.

## References

- [BRO Token](https://github.com/CharmsDev/bro) - Mining reference implementation
- [nextjs-native-starter](https://github.com/RobSchilderr/nextjs-native-starter) - Architecture reference
- [Charms Protocol](https://charms.dev/) - Bitcoin smart contracts
- [BitcoinOS](https://www.bitcoinos.build/) - Bitcoin L2 with ZK verification

## License

MIT
