# Genesis Babies NFT Deployment Guide

## Overview

This guide explains how to deploy the Genesis Babies NFT collection to Bitcoin using Ordinals inscriptions.

**Architecture:** On-chain generative NFTs (like CryptoPunks/OnChainMonkey)
- Infrastructure inscribed once (~$20-65)
- Each NFT stores only DNA (~50 bytes, ~$0.50-2)
- Images rendered on-demand from DNA

## Cost Breakdown

| Component | Size | Fee (10 sat/vB) | Cost @ $100k BTC |
|-----------|------|-----------------|------------------|
| Sprite Library | ~15KB | ~5,000 sats | ~$5 |
| HTML Renderer | ~5KB | ~2,000 sats | ~$2 |
| **Infrastructure Total** | ~20KB | ~7,000 sats | **~$7** |
| Per NFT | ~100 bytes | ~180 sats | ~$0.18 |

*Note: Actual costs vary with network fees. At 50 sat/vB, multiply by 5.*

## Prerequisites

1. **Bitcoin wallet** with:
   - Taproot support (P2TR addresses)
   - PSBT signing capability
   - Testnet4 or Mainnet funds

2. **Inscription tool** (choose one):
   - `ord` CLI (recommended)
   - Unisat inscribe
   - Ordinals Bot

3. **Node.js 18+** for building inscription data

## Step 1: Build Inscription Data

```bash
# Navigate to bitcoin package
cd packages/bitcoin

# Run build script (creates inscription files)
pnpm run build:inscriptions
```

This generates:
- `dist/inscriptions/library.json` - Sprite library
- `dist/inscriptions/renderer.html` - On-chain renderer
- `dist/inscriptions/manifest.json` - Deployment manifest

## Step 2: Inscribe Sprite Library

The sprite library contains all visual components. Inscribe first.

```bash
# Using ord CLI
ord wallet inscribe \
  --file dist/inscriptions/library.json \
  --content-type "application/json" \
  --fee-rate 10 \
  --destination <YOUR_TAPROOT_ADDRESS>
```

**Save the inscription ID!** Format: `<txid>i0`

Example: `abc123def456...i0`

## Step 3: Inscribe HTML Renderer

Update the renderer with the library inscription ID, then inscribe.

```typescript
// In your deployment script
import { generateRendererInscription } from '@bitcoinbaby/bitcoin';

const renderer = generateRendererInscription({
  libraryInscriptionId: 'abc123def456...i0', // From Step 2
  minify: true
});

// Write to file
fs.writeFileSync('renderer.html', renderer.content);
```

```bash
# Inscribe renderer
ord wallet inscribe \
  --file renderer.html \
  --content-type "text/html" \
  --fee-rate 10 \
  --destination <YOUR_TAPROOT_ADDRESS>
```

**Save the renderer inscription ID!**

## Step 4: Create Collection Inscription (Optional)

For marketplace compatibility, create a collection inscription:

```json
{
  "p": "ordinals",
  "name": "Genesis Babies",
  "description": "10,000 unique babies on Bitcoin",
  "image": "/content/<RENDERER_ID>?dna=0000000000000000",
  "external_url": "https://bitcoinbaby.app",
  "total_supply": 10000
}
```

## Step 5: Mint Individual NFTs

For each NFT mint, generate minimal inscription:

```typescript
import { generateMinimalNFTInscription, generateNFTMetadata } from '@bitcoinbaby/bitcoin';

// Generate unique DNA for this NFT
const dna = generateDNA(); // Your DNA generation logic

// Create inscription data
const nft = generateMinimalNFTInscription({
  tokenId: 1,
  dna: dna,
  rendererInscriptionId: '<RENDERER_ID>'
});

// The content is just: <!DOCTYPE html><meta http-equiv="refresh" content="0;url=/content/<RENDERER_ID>?dna=...">
console.log(nft.content);
console.log(`Size: ${nft.size} bytes`); // ~100-150 bytes
```

## Viewing NFTs

Once inscribed, NFTs are viewable on:

1. **Ordinals Explorer:** `https://ordinals.com/inscription/<NFT_ID>`
2. **Magic Eden:** Automatically indexed
3. **Unisat:** Via wallet or marketplace
4. **Any Ordinals viewer** that supports HTML inscriptions

The viewer:
1. Loads the NFT inscription
2. Follows redirect to renderer
3. Renderer parses DNA from URL
4. Generates and displays SVG image

## Testing on Testnet4

```bash
# 1. Get testnet4 coins
# Faucet: https://mempool.space/testnet4/faucet

# 2. Configure for testnet
export BITCOIN_NETWORK=testnet4

# 3. Test inscriptions with low fees
ord --chain testnet4 wallet inscribe \
  --file test.html \
  --fee-rate 1

# 4. View on testnet explorer
# https://mempool.space/testnet4/tx/<TXID>
```

## Integration with Charms

Genesis Babies use Charms for:
- **On-chain state:** Level, XP, work count
- **Evolution:** Burn $BABTC to level up
- **Mining boosts:** NFT rarity affects rewards

The Charms state is stored separately from the Ordinals inscription:

```
Ordinals Inscription: Visual (DNA → image)
Charms State: Game state (level, XP, etc.)
```

Both are linked by the same DNA/tokenId.

## Deployment Checklist

- [ ] Build inscription data
- [ ] Fund deployment wallet (~0.001 BTC for infrastructure)
- [ ] Inscribe sprite library
- [ ] Record library inscription ID
- [ ] Inscribe renderer with library ID
- [ ] Record renderer inscription ID
- [ ] Create collection inscription
- [ ] Test mint on testnet
- [ ] Verify rendering on explorers
- [ ] Set up mint page
- [ ] Configure Charms for state management

## Troubleshooting

### NFT not rendering
- Check renderer inscription is accessible
- Verify DNA parameter in URL
- Test renderer locally first

### High fees
- Wait for lower fee periods (weekends)
- Use batch inscription tools
- Consider fee bumping (RBF)

### Wrong network
- Ensure ord CLI is using correct chain flag
- Verify wallet is on same network

## API Reference

```typescript
// Get deployment cost estimate
import { getDeploymentSummary } from '@bitcoinbaby/bitcoin';

const summary = getDeploymentSummary(10); // 10 sat/vB
console.log(`Infrastructure: $${summary.estimates.estimatedInfrastructureUSD}`);
console.log(`Per NFT: $${summary.estimates.estimatedPerNFTUSD}`);

// Generate inscription plan
import { generateInscriptionPlan } from '@bitcoinbaby/bitcoin';

const plan = generateInscriptionPlan({ feeRate: 10 });
console.log(`Total inscriptions: ${plan.inscriptions.length}`);
console.log(`Total size: ${plan.totalSize} bytes`);
```

## Support

- Discord: [BitcoinBaby Community]
- GitHub: [Issues](https://github.com/bitcoinbaby/bitcoinbaby/issues)
- Docs: [docs.bitcoinbaby.app](https://docs.bitcoinbaby.app)
