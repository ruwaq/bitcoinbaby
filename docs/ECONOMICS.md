# SPARK Economics

> Status: design reference. The on-chain constants are live in the contracts
> and worker config; the operator decisions marked **TODO(deploy)** must be
> set before mainnet launch.

This document describes how value flows through the SPARK system: how mining
rewards are minted, how NFT sales are priced, and where the operator's revenue
and costs come from. It is the single source of truth for the numbers behind
`NFT_MINT_PRICE_SATS`, `SPARK_START_TIME`, and the BABTC emission schedule.

---

## 1. Mining (SPARK token)

SPARK is mined with Proof-of-Work on top of Bitcoin, exactly mirroring the
BRO token model. Mining is **free for the operator**: the prover cost is paid
by the operator, but the reward is **newly emitted SPARK** — it does not come
out of the operator's wallet. This is how Bitcoin itself works: miners are
paid by issuance, not by a buyer.

### Emission formula

```
reward = BRO_DENOMINATION · clz² / 2^halvings
halvings = clamp(0, floor((block_time - SPARK_START_TIME) / 14d), 63)
```

| Constant                     | Value                                                | Source                                 |
| ---------------------------- | ---------------------------------------------------- | -------------------------------------- |
| `BRO_DENOMINATION`           | `100_000_000`                                        | `babtc/src/lib.rs:36`                  |
| `BRO_HALVING_PERIOD_SECONDS` | `14 * 24 * 3600` (14 days)                           | `babtc/src/lib.rs:55`                  |
| `MAX_HALVING_PERIODS`        | `63`                                                 | `babtc/src/lib.rs:58`                  |
| `MIN_DIFFICULTY`             | `16`                                                 | `babtc/src/lib.rs:32`                  |
| `SPARK_START_TIME`           | `1_758_102_000` (**TODO(deploy)** — mainnet genesis) | `babtc/src/lib.rs:52`, `bro-reward.ts` |

At genesis (period 0, clz=16): `reward = 1e8 · 256 / 1 = 25_600_000_000`
units. The reward halves every 14 days, capped at 63 halvings.

**Critical:** `SPARK_START_TIME` must be **identical** in the contract
(`babtc/src/lib.rs`) and the worker signer (`bro-reward.ts`). A mismatch
makes every mining spell fail on-chain verification. The placeholder
`1_758_102_000` (2026-09-15T00:00:00Z) must be replaced with the real
mainnet genesis timestamp before deploy.

---

## 2. NFT sales (Genesis Sparks)

### Pricing

| Parameter              | Value                              | Source                           |
| ---------------------- | ---------------------------------- | -------------------------------- |
| `NFT_MINT_PRICE_SATS`  | `5000` (~$3 at 60k sats/USD)       | `wrangler.toml` (dev + prod)     |
| `NFT_DUST_SATS`        | `330`                              | `services/nft-spell-utils.ts:36` |
| Mint fee reserve       | `1000` sats                        | `routes/nft/mint.ts`             |
| Total a user must fund | `≥ 6330` sats (price + dust + fee) | —                                |

The user pays `NFT_MINT_PRICE_SATS` to the `NFT_TREASURY_ADDRESS` **in the
same Bitcoin transaction that mints the NFT** (atomic /mint flow, D3). This
closes the "mint without paying" bug: there is no way to produce a valid NFT
spell that does not also pay the treasury.

### Cost breakdown per mint

The operator's prover cost is **per transaction, not per NFT**. With batch
minting (a single spell proving multiple mints), the proof cost amortizes:

| Item                            | Cost (approx) | Notes                                             |
| ------------------------------- | ------------- | ------------------------------------------------- |
| Succinct prover (per tx)        | ~$0.20–1.00   | Credits or self-hosted; **TODO(deploy)** decision |
| Bitcoin fee (1-in/3-out P2TR)   | ~$0.01–0.05   | User-paid (funding UTXO)                          |
| Batch amortized proof (per NFT) | ~$0.005       | At ~100 NFTs/tx                                   |

### Margin

At a $3 sale price and ~$0.75 fully-loaded cost (prover + gas + infra
share), the **gross margin is ~75%**. Break-even is reached at roughly
**100 active users** given the fixed prover retainer.

---

## 3. Marketplace (P2P resale)

Users trade NFTs among themselves via PSBT atomic swaps (`/list`, `/buy`,
`/unlist`). The operator takes a platform fee on token claims
(`PLATFORM_FEE_PERCENT = "20"`, routed to `FOUNDATION_ADDRESS`). NFT resale
fees, if introduced, would layer on the same mechanism.

| Parameter              | Value                              | Source                         |
| ---------------------- | ---------------------------------- | ------------------------------ |
| `PLATFORM_FEE_PERCENT` | `20` (20%)                         | `wrangler.toml`                |
| `FOUNDATION_ADDRESS`   | `tb1p8x47...`                      | `wrangler.toml`                |
| Min listing price      | `1000` sats                        | `listNftSchema`                |
| Dust mismatch (D4.1)   | Resolved — buy & mint both use 330 | `buy.ts`, `nft-spell-utils.ts` |

---

## 4. Operator cash flow (summary)

```
REVENUE
  NFT sales        → NFT_TREASURY_ADDRESS   (5000 sats × mints)
  Platform fees    → FOUNDATION_ADDRESS     (20% of token claims)

COSTS
  Prover           → Succinct credits or self-host   (per-tx, TODO decision)
  Infra            → Cloudflare Workers + Upstash    (flat)
  Mining           → $0  (paid by newly emitted SPARK, NOT by operator)
```

Mining is intentionally **not** an operator cost: it is funded by token
emission, exactly as Bitcoin issuance funds Bitcoin miners. The operator's
business is NFT sales + platform fees, not selling mining power.

---

## 5. Deploy-time decisions (operator, NOT code)

These three values must be set before mainnet and cannot be defaulted
safely:

1. **`SPARK_START_TIME`** — the real mainnet genesis timestamp. Must match
   exactly between `babtc/src/lib.rs` and `bro-reward.ts`.
2. **`NFT_TREASURY_ADDRESS`** — the mainnet treasury that receives NFT sale
   BTC. Currently the testnet4 placeholder.
3. **Prover capacity** — buy Succinct credits or self-host a `charms server`.
   Blocks any real genesis mint until resolved.

None of these block the D3-D5 code work; they are flagged with
`TODO(deploy)` in the source.
