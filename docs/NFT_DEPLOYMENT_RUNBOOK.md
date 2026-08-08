# NFT Deployment Runbook — Genesis Sparks on testnet4 (Charms v15)

This is the copy-pasteable procedure for performing the **genesis mint** of the
Genesis Sparks NFT contract on Bitcoin testnet4. The genesis mint is what
"deploys" a Charms contract — there is no `charms app deploy` command. Instead
you build a genesis spell, ask the prover to prove it, sign + broadcast the
resulting transactions, and the funding UTXO's id becomes the app's permanent
identity.

This runbook accompanies `scripts/deploy-nft-contract.ts`, which automates
everything except the wallet signing (which must be done by a human who holds
the private key).

> **Task scope.** This runbook + script are Task 4.1. The actual genesis mint
> (spending real testnet4 funds) is **Task 4.2** — a human checkpoint that
> requires the deployer's testnet4 wallet.

---

## How the app identity is derived (read this first)

A Charms app's permanent identity is:

```
app_id = SHA256("<fundingTxid>:<fundingVout>")
```

where `<fundingTxid>:<fundingVout>` is the **funding UTXO** — the input the
genesis spell spends. This is computed **before** the prover is called; there is
no chicken-and-egg. Three independent sources confirm this:

1. **The v15 spike** (`docs/superpowers/notes/charms-v15-witness-spike.md`,
   Section 1): the witness `w` decodes to the UTXO string
   `d8fa...:0`, and the app id in the request key is
   `SHA256("d8fa...:0") = 8fed59719e6f4f509691bf5589888d3bde168b34904a952e70b1024d163297a8`.
2. **The spike-nft scaffold** (`/tmp/spike-nft/README.md`):
   ```sh
   export in_utxo_0="d8fa...:0"
   export app_id=$(echo -n "${in_utxo_0}" | sha256sum | cut -d' ' -f1)
   ```
3. **The spike-nft contract** (`/tmp/spike-nft/src/lib.rs`, `can_mint_nft`):
   ```rust
   check!(hash(&w_str) == nft_app.identity);       // SHA256(witness string) == app id
   let w_utxo_id = UtxoId::from_str(&w_str).unwrap();
   check!(tx.ins.iter().any(|(utxo_id, _)| utxo_id == &w_utxo_id));  // witness UTXO is the spell input
   ```

The **commit tx** produced by the prover is just a wrapper: it spends your
funding UTXO and creates a P2TR output whose scriptPubKey encodes this
pre-computed app id. The **spell tx** then spends that commit output to mint
the NFT. So although the task description loosely says "app id = SHA256 of the
genesis/commit UTXO", the precise statement is **app id = SHA256 of the funding
UTXO the spell spends** — known up front.

The deploy script computes this with Node's `crypto`:
```ts
appId = crypto.createHash("sha256").update(`${fundingTxid}:${fundingVout}`, "utf8").digest("hex");
```

---

## Prerequisites

- **testnet4 wallet** with at least **2000 sats** in a single UTXO you control
  the private key for. Get testnet4 coins from the faucet:
  https://mempool.space/testnet4/faucet (or https://tbtc.bitaps.com/).
- **A p2tr (bech32m, `tb1p...`) address** from that wallet — this becomes the
  owner of `token_id = 1` and receives the change + the minted NFT.
- **Charms CLI v15** installed (only needed if you want to inspect spells
  manually; the script talks to the hosted prover directly):
  ```sh
  ./scripts/install-charms-cli.sh
  charms --version    # expect v15.x
  ```
- **Repo** on branch `feat/testnet4-profesional-nft`, dependencies installed
  (`pnpm install`).
- **Prover reachable** at https://v15.charms.dev (override with `--prover-url`
  or `PROVER_URL`). Health: `curl -s https://v15.charms.dev/ready`.
- **`tsx`** for running the script (`pnpm tsx` resolves it from the workspace).

---

## Step 1 — Get a funding UTXO

1. Send yourself some tBTC to your testnet4 p2tr address (or receive from the
   faucet). Wait for **1 confirmation** (the prover needs the funding tx to be
   in a block so it can fetch the prev tx).
2. Find a suitable UTXO via mempool.space testnet4:
   https://mempool.space/testnet4/address/<your-address>
   - Note the **txid** (64 hex chars, display order), the **vout** (output
     index, usually 0), and the **value** in sats. Pick one worth >= 2000 sats.

You now have the three values the script needs:
`--funding-txid`, `--funding-vout`, `--funding-value`.

## Step 2 — Run the deploy script (prover call)

```sh
cd /Users/munay/dev/bitcoinbaby

pnpm tsx scripts/deploy-nft-contract.ts \
  --funding-txid <TXID> \
  --funding-vout <VOUT> \
  --funding-value <SATS> \
  --owner-address <tb1p...>
```

Optional flags:
- `--network testnet4` (default) — mempool API base for prev-tx fetch.
- `--prover-url https://v15.charms.dev` (default) — the prover.
- `--dry-run` — build + post to the prover, but skip the signing pause (useful
  to test the plumbing without broadcasting).
- `--apply` — after the commit txid is captured, WRITE the app id into
  `wrangler.toml` + `testnet4.ts` automatically. Default is print-only so a
  human reviews.

The script will:
1. Print the computed `app_id = SHA256("<txid>:<vout>")`.
2. Build the v15 genesis spell (token_id=1, deterministic DNA/traits).
3. Fetch the funding tx's prev-tx hex from mempool.
4. POST to `${PROVER_URL}/spells/prove` and parse the response into
   `{ commitTxHex, spellTxHex }` (handles both the `{commitTx, spellTx}` object
   shape and the `[ {bitcoin: ...}, {bitcoin: ...} ]` array shape).
5. Write the two hex blobs to `/tmp/nft-deploy-commit.hex` and
   `/tmp/nft-deploy-spell.hex`, then **pause** for signing.

If the prover returns an error here, see **Troubleshooting** below.

## Step 3 — Sign the commit + spell transactions

The prover returns **unsigned raw transaction hex** (not a PSBT). You must sign
both with the private key that controls the funding UTXO. The signing is a
standard **Taproot key-path spend** (SIGHASH_DEFAULT).

### Option A — `sign-and-broadcast.ts` (scripted, needs mnemonic)

The repo ships `scripts/sign-and-broadcast.ts`, which derives a p2tr key from a
BIP39 mnemonic, computes the BIP340/341 tweaked key, signs, and broadcasts. Run
it once per transaction:

```sh
# Sign + broadcast the COMMIT tx first:
MNEMONIC="your twelve word mnemonic phrase here" \
TX_HEX="$(cat /tmp/nft-deploy-commit.hex)" \
pnpm tsx scripts/sign-and-broadcast.ts

# Note the commit txid it prints, wait ~1 block, then sign + broadcast the SPELL tx:
MNEMONIC="your twelve word mnemonic phrase here" \
TX_HEX="$(cat /tmp/nft-deploy-spell.hex)" \
pnpm tsx scripts/sign-and-broadcast.ts
```

### Option B — Sparrow Wallet (GUI)

1. In Sparrow, open your testnet4 wallet.
2. For each tx: **File → Open Transaction** (or "Import") → paste the raw hex.
   Sparrow treats it as an unsigned PSBT-like object; use **Sign** with your
   keypath. (If Sparrow refuses raw hex, convert to PSBT first — see
   Troubleshooting.)
3. Copy the signed hex.

### Option C — bitcoinjs-lib / any Taproot signer

Use `scripts/sign-and-broadcast.ts` as a template: `hashForWitnessV1` with
`SIGHASH_DEFAULT`, `signSchnorr` with the BIP341-tweaked private key, then
`setWitness(0, [sig])`.

## Step 4 — Broadcast to testnet4

**Order matters: broadcast the commit tx first, wait for it to land (1
confirmation), then broadcast the spell tx** (the spell spends commit output
0).

Broadcast endpoint (raw hex body, `Content-Type: text/plain`):

```sh
curl -sX POST https://mempool.space/testnet4/api/tx \
  -H "Content-Type: text/plain" \
  --data-binary @/tmp/nft-deploy-commit-signed.hex
# => <commitTxid>

# ... wait for 1 confirmation ...

curl -sX POST https://mempool.space/testnet4/api/tx \
  -H "Content-Type: text/plain" \
  --data-binary @/tmp/nft-deploy-spell-signed.hex
# => <spellTxid>
```

(`sign-and-broadcast.ts` does the broadcast for you in Option A.)

## Step 5 — Confirm on-chain

- Commit tx: https://mempool.space/testnet4/tx/<commitTxid>
- Spell tx: https://mempool.space/testnet4/tx/<spellTxid>

Both should show as confirmed. The spell tx output 0 is your minted NFT UTXO.

## Step 6 — Capture the commit txid and get the app id

Back in the deploy-script terminal, the script prompted:

```
Paste the COMMIT tx txid once broadcast (or press Enter to skip ...): 
```

Paste the **commit txid**. The script will re-affirm the app id. (It was
already known from the funding UTXO; the script just prints it prominently for
the config step.)

If you killed the script, you can recompute it by hand:
```sh
echo -n "<fundingTxid>:<fundingVout>" | shasum -a 256
```

## Step 7 — Update config + redeploy workers

Update these three places with the app id (the script prints the exact lines;
add `--apply` to write them automatically):

**`apps/workers/wrangler.toml`** — set `NFT_APP_ID` in **both** `[vars]` (dev)
and `[env.production.vars]` (prod):
```toml
NFT_APP_ID = "<the-64-hex-app-id>"
```

**`packages/bitcoin/src/config/testnet4.ts`** — update the
`GENESIS_SPARKS_TESTNET4.appId` fallback string:
```ts
appId:
  process.env.NEXT_PUBLIC_GBABY_APP_ID ||
  process.env.GBABY_APP_ID ||
  "<the-64-hex-app-id>",
```

Then redeploy:
```sh
# Dev/staging
pnpm --filter @bitcoinbaby/workers deploy

# Production
pnpm --filter @bitcoinbaby/workers deploy:production
```

## Step 8 — Verify

The worker previously returned `503` / "NFT app ID not yet established" because
`NFT_APP_ID` was a placeholder. After redeploy:

```sh
# Replace <worker-host> with your Cloudflare worker URL
curl -s "https://<worker-host>/health" | jq .
# Expect: nft / app_id fields populated, no 503.

# Try a mint (requires auth / faucet balance per the worker's normal flow):
curl -sX POST "https://<worker-host>/nft/mint" -H "Content-Type: application/json" \
  -d '{"ownerAddress":"tb1p..."}' | jq .
```

You can also confirm the app exists on Charms' indexer (Scrolls):
https://scrolls.charms.dev/ — search for the app id.

---

## Troubleshooting

### Prover returns `400 ... all apps should run successfully`

This means the prover ran your contract binary against the spell and the
contract returned `false` (rejected the operation). Common causes:

1. **Worker/contract state schema mismatch.** The contract
   (`packages/bitcoin/contracts/genesis-babies/src/lib.rs`) deserializes the
   output state with `data.value::<SparkNFTState>()`. Its struct includes a
   `heritage: u32` field. If the worker's `SparkNFTState`
   (`apps/workers/src/services/nft-spell-utils.ts`) omits `heritage`, serde
   fails, `single_output_state` returns `None`, and `validate_mint` returns
   `false`. **Check that every field the contract struct declares is present
   in the worker's emitted state.** Fix the worker type (and the genesis NFT
   builder) to match the contract, rebuild the contract if needed, re-embed
   the binary (`nft-contract-binary.ts`), and retry.
2. **Witness missing / misrouted.** If `app_private_inputs` is absent, the
   contract's `w.value()` errors and it falls into the transfer branch, which a
   genesis mint fails. Confirm the script's `[witness]` log line shows the
   `n/<appId>/<vk>` key.
3. **VK mismatch.** The prover keys `binaries` and `app_private_inputs` by the
   contract's verification key. If `NFT_CONTRACT_VK` in
   `nft-contract-binary.ts` doesn't match the binary's actual VK, the contract
   won't run. Regenerate with `charms app vk <wasm>` and re-embed.
4. **Wrong spell version.** The script pins `version: 15`. An 11 will be
   rejected.

To debug, run the CLI mock locally against the same spell:
```sh
charms spell check --spell spell.yaml --prev-txs <hex> \
  --app-bins <wasm> --private-inputs priv.yaml
```

### Prover `503` / timeout / connection refused

- The hosted prover (`https://v15.charms.dev`) occasionally restarts. Retry
  after a minute. Health check: `curl -s https://v15.charms.dev/ready`.
- For custom contracts not registered on the hosted prover, run a local
  prover: `charms server` (listens on `localhost:17784`), then pass
  `--prover-url http://localhost:17784`.

### Raw TX vs PSBT

The prover returns **unsigned raw transaction hex**, not a PSBT. Tools that
expect a PSBT (some Sparrow import paths) will refuse it. To sign raw hex:

- Use `scripts/sign-and-broadcast.ts` (handles raw hex + taproot keypath
  directly via `bitcoinjs-lib`).
- Or construct a PSBT in code and copy the witness back.

If your wallet only signs PSBTs, wrap the raw tx: build a PSBT with one input
(the funding UTXO for the commit tx; commit output 0 for the spell tx) and one
output matching the raw tx, sign, extract the final witness, and apply it to
the raw tx via `bitcoinjs-lib`'s `Transaction.setWitness`.

### Version skew (CLI / prover / contract)

All three must agree on v15:
- CLI: `charms --version` -> v15.x
- Prover: `curl -s https://v15.charms.dev/ready` (the `v15` subdomain implies
  v15, but confirm).
- Contract `Cargo.toml`: `charms-sdk = "15.0.0"`, `edition = "2024"`.

A v11 spell/contract against the v15 prover will fail with a vague error.

### VK mismatch after recompiling the contract

The VK is the SHA256 of the compiled `.wasm`. If you rebuild the contract
(even with trivial changes), the VK changes and `nft-contract-binary.ts` must
be regenerated:
```sh
cd packages/bitcoin/contracts/genesis-babies
cargo build --release --target wasm32-wasip1
charms app vk target/wasm32-wasip1/release/genesis_babies.wasm
# paste the VK + base64/hex of the wasm into apps/workers/src/lib/nft-contract-binary.ts
```

### "Cannot find module '../apps/workers/...'"

The script imports the worker's `nft-contract-binary.ts` and
`nft-spell-utils.ts` via a relative path from `scripts/`. Run the script from
the repo root (`pnpm tsx scripts/deploy-nft-contract.ts`), not from inside
`scripts/`. If the import still fails, your `tsx` version may not resolve
cross-package relative paths; ensure `tsx >= 4.x` (the repo pins it).

---

## Quick reference — the one-screen version

```sh
# 1. (have a confirmed >= 2000 sat UTXO at your tb1p... address)

# 2. Build the spell + call the prover:
pnpm tsx scripts/deploy-nft-contract.ts \
  --funding-txid <TXID> --funding-vout <VOUT> --funding-value <SATS> \
  --owner-address <tb1p...>

# 3-4. Sign + broadcast (commit FIRST, then spell), using sign-and-broadcast.ts:
MNEMONIC="..." TX_HEX="$(cat /tmp/nft-deploy-commit.hex)" pnpm tsx scripts/sign-and-broadcast.ts
# wait 1 block
MNEMONIC="..." TX_HEX="$(cat /tmp/nft-deploy-spell.hex)"  pnpm tsx scripts/sign-and-broadcast.ts

# 5. Confirm on https://mempool.space/testnet4/tx/<commitTxid>

# 6. Paste commit txid into the deploy-script prompt -> get app id.
#    (or: echo -n "<TXID>:<VOUT>" | shasum -a 256)

# 7. Put the app id into apps/workers/wrangler.toml (dev+prod NFT_APP_ID)
#    and packages/bitcoin/src/config/testnet4.ts, then:
pnpm --filter @bitcoinbaby/workers deploy
pnpm --filter @bitcoinbaby/workers deploy:production

# 8. curl the worker /health -> no more 503.
```
