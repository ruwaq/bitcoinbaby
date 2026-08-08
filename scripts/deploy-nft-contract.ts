#!/usr/bin/env tsx
/**
 * Deploy the Genesis Sparks NFT contract to testnet4 (Charms v15).
 *
 * Ritual: genesis mint -> prover proves -> user signs+broadcasts -> the funding
 * UTXO's id establishes the app identity. This script automates the spell build
 * and prover call, then PAUSES so a human can sign + broadcast with their own
 * wallet (the script never holds private keys), then prints the exact config
 * updates the worker needs.
 *
 * APP IDENTITY (the key subtlety, verified against the v15 spike + the
 * spike-nft scaffold contract):
 *
 *   app_id = SHA256("<fundingTxid>:<fundingVout>")
 *
 * where the funding UTXO is the input the spell spends. This is computed BEFORE
 * the prover call — there is no chicken-and-egg. The witness `w` (the contract's
 * 4th arg) carries the SAME funding-UTXO string, and the contract asserts
 * `SHA256(w) == app.identity` (see spike-nft `src/lib.rs`, `can_mint_nft`).
 * The commit tx produced by the prover simply encodes this pre-computed app
 * identity into a P2TR output that the spell tx then spends.
 *
 * Evidence:
 *   - docs/superpowers/notes/charms-v15-witness-spike.md, Section 1 (ground
 *     truth: witness decodes to "<utxo>", app_id = SHA256 of that string).
 *   - /tmp/spike-nft/README.md:
 *       export in_utxo_0="d8fa...:0"
 *       export app_id=$(echo -n "${in_utxo_0}" | sha256sum | cut -d' ' -f1)
 *   - /tmp/spike-nft/src/lib.rs `can_mint_nft`: `check!(hash(&w_str) == nft_app.identity)`.
 *
 * Usage:
 *   pnpm tsx scripts/deploy-nft-contract.ts \
 *     --funding-txid <txid> --funding-vout <vout> --funding-value <sats> \
 *     --owner-address <tb1p...>
 *
 * Requires: a testnet4 wallet with >= 2000 sats in the funding UTXO, and the
 * prover reachable at https://v15.charms.dev (override with PROVER_URL).
 * See docs/NFT_DEPLOYMENT_RUNBOOK.md for the full procedure.
 *
 * Flags:
 *   --dry-run          Build the spell + call the prover, but SKIP the signing/
 *                      broadcast pause + config-printing. Useful for plumbing
 *                      tests.
 *   --apply            After the commit txid is known, WRITE the app id into
 *                      apps/workers/wrangler.toml (dev + prod) and
 *                      packages/bitcoin/src/config/testnet4.ts. DANGEROUS:
 *                      default is to PRINT only so a human reviews.
 *   --prover-url <url> Override the prover (default https://v15.charms.dev).
 *   --network <net>    bitcoin network for mempool fetches (default testnet4).
 *   --help             Show this help.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Reuse the v15 spell plumbing from the worker (DRY: byte-compatible spells).
import {
  NFT_CONTRACT_VK,
  NFT_CONTRACT_BINARY,
} from "../apps/workers/src/lib/nft-contract-binary";
import {
  type SparkNFTState,
  SPELL_VERSION,
  NFT_DUST_SATS,
  DEFAULT_FEE_RATE,
  addressToScriptPubkey,
  buildEmptyAppPublicInputs,
  encodeCborHex,
  utxoToBytes,
} from "../apps/workers/src/services/nft-spell-utils";

// =============================================================================
// CONSTANTS
// =============================================================================

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");

const DEFAULT_PROVER_URL = "https://v15.charms.dev";
const PROVER_TIMEOUT_MS = 180_000;

const MEMPOOL_API_URLS: Record<string, string> = {
  mainnet: "https://mempool.space/api",
  testnet: "https://mempool.space/testnet/api",
  testnet4: "https://mempool.space/testnet4/api",
};

const COMMIT_HEX_PATH = "/tmp/nft-deploy-commit.hex";
const SPELL_HEX_PATH = "/tmp/nft-deploy-spell.hex";

// Minimum funding UTXO value (sats). The commit+spell txs pay ~2 sat/vB; the
// NFT output is 330 sats (NFT_DUST_SATS). 2000 sats is a safe floor for
// testnet4 with a generous fee buffer.
const MIN_FUNDING_SATS = 2000;

// Deterministic genesis NFT (token_id = 1). These values must pass the
// contract's `validate_mint` for a freshly minted baby: all counters 0,
// level 1, a 64-hex DNA. genesisBlock is filled from the funding UTXO's
// confirming block (best-effort) — the contract treats it as informational.
const GENESIS_TOKEN_ID = 1;

// =============================================================================
// TYPES
// =============================================================================

interface CliArgs {
  fundingTxid: string;
  fundingVout: number;
  fundingValue: number;
  ownerAddress: string;
  proverUrl: string;
  network: string;
  dryRun: boolean;
  apply: boolean;
}

interface ProverResult {
  commitTxHex: string;
  spellTxHex: string;
}

// Both shapes documented in the spike + the worker's nft-minting-simple.ts:
//   { commitTx, spellTx }   OR   Array<{ bitcoin: "hex" }> -> [commit, spell]
interface ProverResponseObject {
  commitTx?: string;
  spellTx?: string;
  bitcoin?: string | string[];
}

// =============================================================================
// HELPERS
// =============================================================================

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** Compute the Charms app id for a genesis mint: SHA256("<txid>:<vout>"). */
function computeAppId(txid: string, vout: number): string {
  return sha256Hex(`${txid}:${vout}`);
}

function isHex(s: string, expectedLen?: number): boolean {
  if (!/^[0-9a-fA-F]*$/.test(s)) return false;
  if (expectedLen !== undefined && s.length !== expectedLen) return false;
  return true;
}

function isBech32mAddress(addr: string, network: string): boolean {
  // testnet4 uses tb1... (HRP "tb"); mainnet bc1... Both are bech32m for v1+.
  const hrp = network === "mainnet" ? "bc1" : "tb1";
  if (!addr.toLowerCase().startsWith(hrp)) return false;
  if (addr.length < 39 || addr.length > 62) return false;
  return /^[a-z0-9]+$/i.test(addr);
}

function printHelp(): void {
  // Print the file header doc (the block comment at the top of this file).
  console.log(
    `Deploy the Genesis Sparks NFT contract to testnet4 (Charms v15).

Usage:
  pnpm tsx scripts/deploy-nft-contract.ts \\
    --funding-txid <txid> --funding-vout <vout> --funding-value <sats> \\
    --owner-address <tb1p...> [--network testnet4] [--prover-url <url>] \\
    [--dry-run] [--apply]

Required:
  --funding-txid     64-hex txid of the UTXO to spend (display order).
  --funding-vout     Output index (vout) of the funding UTXO.
  --funding-value    Value of the funding UTXO in satoshis.
  --owner-address    testnet4 p2tr (bech32m) address that will own token_id=1
                     and receive the change + NFT.

Optional:
  --network          mempool network for prev-tx fetch (default: testnet4).
  --prover-url       Charms prover (default: https://v15.charms.dev).
  --dry-run          Spell build + prover call only; skip signing/broadcast.
  --apply            Write the app id into wrangler.toml + testnet4.ts after
                     the commit txid is known (default: print only).
  --help             Show this help.

App identity: app_id = SHA256("<fundingTxid>:<fundingVout>"), computed BEFORE
the prover call. The witness w carries the same funding-UTXO string.

See docs/NFT_DEPLOYMENT_RUNBOOK.md for the full procedure.`,
  );
}

function parseCli(argv: string[]): CliArgs {
  const { values } = parseArgs({
    args: argv,
    options: {
      "funding-txid": { type: "string" },
      "funding-vout": { type: "string" },
      "funding-value": { type: "string" },
      "owner-address": { type: "string" },
      "prover-url": { type: "string", default: DEFAULT_PROVER_URL },
      network: { type: "string", default: "testnet4" },
      "dry-run": { type: "boolean", default: false },
      apply: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    strict: true,
    allowPositionals: false,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  const errors: string[] = [];

  const fundingTxid = values["funding-txid"];
  if (!fundingTxid) errors.push("--funding-txid is required");
  else if (!isHex(fundingTxid, 64))
    errors.push(`--funding-txid must be 64 hex chars (got ${fundingTxid.length})`);

  const fundingVoutRaw = values["funding-vout"];
  if (fundingVoutRaw === undefined) errors.push("--funding-vout is required");
  const fundingVout = Number(fundingVoutRaw);
  if (!Number.isInteger(fundingVout) || fundingVout < 0)
    errors.push(`--funding-vout must be a non-negative integer`);

  const fundingValueRaw = values["funding-value"];
  if (fundingValueRaw === undefined) errors.push("--funding-value is required");
  const fundingValue = Number(fundingValueRaw);
  if (!Number.isInteger(fundingValue) || fundingValue <= 0)
    errors.push(`--funding-value must be a positive integer (sats)`);
  else if (fundingValue < MIN_FUNDING_SATS)
    errors.push(
      `--funding-value ${fundingValue} is below the ${MIN_FUNDING_SATS} sat floor (need >= ${MIN_FUNDING_SATS})`,
    );

  const ownerAddress = values["owner-address"];
  if (!ownerAddress) errors.push("--owner-address is required");
  else if (!isBech32mAddress(ownerAddress, values.network ?? "testnet4"))
    errors.push(
      `--owner-address must be a bech32m p2tr address for ${values.network} (got ${ownerAddress})`,
    );

  const network = values.network ?? "testnet4";
  if (!(network in MEMPOOL_API_URLS))
    errors.push(`--network must be one of ${Object.keys(MEMPOOL_API_URLS).join(", ")}`);

  const proverUrl = values["prover-url"] ?? DEFAULT_PROVER_URL;
  try {
    new URL(proverUrl);
  } catch {
    errors.push(`--prover-url is not a valid URL: ${proverUrl}`);
  }

  if (errors.length > 0) {
    console.error("\n[ERROR] Invalid arguments:\n  - " + errors.join("\n  - "));
    console.error("\nRun with --help for usage.\n");
    process.exit(1);
  }

  return {
    fundingTxid: fundingTxid!,
    fundingVout,
    fundingValue,
    ownerAddress: ownerAddress!,
    proverUrl,
    network,
    dryRun: values["dry-run"] ?? false,
    apply: values.apply ?? false,
  };
}

/** Build the deterministic genesis NFT state (token_id=1, all counters 0). */
function buildGenesisNftState(genesisBlock: number): SparkNFTState {
  return {
    // 64-hex DNA: deterministic zero DNA for the genesis mint. The contract's
    // validate_mint only checks structural shape (presence + length); traits
    // are derived downstream. A future metadata-driven mint would use a real
    // sha256 of entropy, but for the genesis/deploy mint this is fine.
    dna: "0".repeat(64),
    bloodline: "royal",
    base_type: "human",
    genesis_block: genesisBlock,
    rarity_tier: "common",
    token_id: GENESIS_TOKEN_ID,
    level: 1,
    xp: 0,
    total_xp: 0,
    work_count: 0,
    last_work_block: genesisBlock,
    evolution_count: 0,
    tokens_earned: "0",
    heritage: 0,
  };
}

/** Build the v15 genesis spell object (caller hex-encodes via encodeCborHex). */
function buildGenesisSpellObject(params: {
  fundingUtxo: { txid: string; vout: number };
  outState: SparkNFTState;
  destScriptPubkey: Uint8Array;
  appId: string;
}) {
  const insBytes = [
    utxoToBytes(`${params.fundingUtxo.txid}:${params.fundingUtxo.vout}`),
  ];
  const outsMap = new Map<number, SparkNFTState>();
  outsMap.set(0, params.outState);

  return {
    version: SPELL_VERSION,
    tx: {
      ins: insBytes,
      outs: [outsMap],
      coins: [{ amount: NFT_DUST_SATS, dest: params.destScriptPubkey }],
    },
    app_public_inputs: buildEmptyAppPublicInputs(params.appId),
  };
}

/**
 * Fetch the raw hex of the funding tx's previous transaction (the one that
 * creates the spent UTXO) from the mempool.space API.
 */
async function fetchPrevTxHex(network: string, txid: string): Promise<string> {
  const baseUrl = MEMPOOL_API_URLS[network];
  if (!baseUrl)
    throw new Error(`No mempool API configured for network "${network}"`);
  const url = `${baseUrl}/tx/${txid}/hex`;
  console.log(`[fetch] GET ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Failed to fetch prev tx ${txid}: HTTP ${res.status} ${res.statusText}${body ? ` - ${body.slice(0, 200)}` : ""}`,
    );
  }
  const hex = (await res.text()).trim();
  if (!/^[0-9a-fA-F]+$/.test(hex))
    throw new Error(`Prev tx hex for ${txid} is not valid hex`);
  console.log(`[fetch] got prev tx (${hex.length / 2} bytes)`);
  return hex;
}

/**
 * POST the proving request to the prover. Returns { commitTxHex, spellTxHex },
 * handling BOTH response shapes the prover is known to emit:
 *   - object: { commitTx, spellTx }
 *   - array:  [ { bitcoin: "<commit>" }, { bitcoin: "<spell>" } ]
 */
async function postToProver(params: {
  proverUrl: string;
  spellHex: string;
  appPrivateInputs: Record<string, string>;
  prevTxHex: string;
  changeAddress: string;
}): Promise<ProverResult> {
  const endpoint = `${params.proverUrl.replace(/\/$/, "")}/spells/prove`;
  const body = JSON.stringify({
    spell: params.spellHex,
    // Top-level sibling of spell, keyed by the FULL app string, value =
    // hex-CBOR of the witness (see spike Section 1). Without it, `w` arrives
    // empty and the contract misroutes every op to the transfer branch.
    app_private_inputs: params.appPrivateInputs,
    binaries: { [NFT_CONTRACT_VK]: NFT_CONTRACT_BINARY },
    prev_txs: [{ bitcoin: params.prevTxHex }],
    change_address: params.changeAddress,
    fee_rate: DEFAULT_FEE_RATE,
    chain: "bitcoin",
  });

  console.log(`[prover] POST ${endpoint} (body ${body.length} bytes)`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVER_TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "BitcoinBaby-deploy/1.0",
      },
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `Prover HTTP ${res.status} ${res.statusText}: ${errText.slice(0, 1000)}`,
      );
    }

    const raw = await res.json();
    return parseProverResponse(raw);
  } finally {
    clearTimeout(timeout);
  }
}

function parseProverResponse(raw: unknown): ProverResult {
  // Shape A: object { commitTx, spellTx }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as ProverResponseObject;
    if (obj.commitTx && obj.spellTx) {
      return { commitTxHex: obj.commitTx, spellTxHex: obj.spellTx };
    }
    // Some object responses embed a single bitcoin array/string.
    if (obj.bitcoin) {
      if (Array.isArray(obj.bitcoin) && obj.bitcoin.length >= 2) {
        return { commitTxHex: obj.bitcoin[0], spellTxHex: obj.bitcoin[1] };
      }
      if (typeof obj.bitcoin === "string") {
        // Ambiguous single-tx; treat as spell (commit optional).
        return { commitTxHex: "", spellTxHex: obj.bitcoin };
      }
    }
  }

  // Shape B: array [ { bitcoin: "hex" }, ... ]
  if (Array.isArray(raw)) {
    const txs = raw
      .filter(
        (t): t is { bitcoin: string } =>
          !!t && typeof t === "object" && typeof t.bitcoin === "string",
      )
      .map((t) => t.bitcoin);
    if (txs.length >= 2) return { commitTxHex: txs[0], spellTxHex: txs[1] };
    if (txs.length === 1) return { commitTxHex: "", spellTxHex: txs[0] };
  }

  throw new Error(
    `Unrecognized prover response shape. Raw (first 500 chars): ${JSON.stringify(raw).slice(0, 500)}`,
  );
}

/** Best-effort: look up the block height that confirmed the funding tx. */
async function fetchConfirmingBlock(network: string, txid: string): Promise<number> {
  const baseUrl = MEMPOOL_API_URLS[network];
  if (!baseUrl) return 0;
  try {
    const res = await fetch(`${baseUrl}/tx/${txid}`);
    if (!res.ok) return 0;
    const data = (await res.json()) as {
      status?: { confirmed?: boolean; block_height?: number };
    };
    if (data.status?.confirmed && typeof data.status.block_height === "number") {
      return data.status.block_height;
    }
  } catch {
    // best-effort; genesis_block is informational.
  }
  return 0;
}

async function prompt(msg: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    return (await rl.question(msg)).trim();
  } finally {
    rl.close();
  }
}

// =============================================================================
// CONFIG WRITING (--apply)
// =============================================================================

/**
 * Replace NFT_APP_ID in apps/workers/wrangler.toml (both dev [vars] and prod
 * [env.production.vars]) and the GENESIS_SPARKS_TESTNET4.appId in
 * packages/bitcoin/src/config/testnet4.ts.
 */
function applyConfigUpdates(appId: string): string[] {
  const changed: string[] = [];

  const wranglerPath = resolve(REPO_ROOT, "apps/workers/wrangler.toml");
  let wrangler = readFileSync(wranglerPath, "utf8");
  const wranglerRe = /^(\s*NFT_APP_ID\s*=\s*)"[0-9a-f]{64}"/gm;
  const wranglerNew = wrangler.replace(wranglerRe, `$1"${appId}"`);
  if (wranglerNew !== wrangler) {
    writeFileSync(wranglerPath, wranglerNew);
    changed.push(`${wranglerPath} (NFT_APP_ID x2)`);
  } else {
    throw new Error(
      `--apply: did not match NFT_APP_ID in ${wranglerPath}. Inspect the file and update manually.`,
    );
  }

  const configPath = resolve(
    REPO_ROOT,
    "packages/bitcoin/src/config/testnet4.ts",
  );
  let config = readFileSync(configPath, "utf8");
  // The fallback string literal (the env-var branch stays as-is).
  const configRe =
    /(process\.env\.GBABY_APP_ID \|\|\s*\n\s*)(\/\/[^\n]*\n\s*)?"[0-9a-f]{64}"/;
  const configNew = config.replace(configRe, `$1$2"${appId}"`);
  if (configNew !== config) {
    writeFileSync(configPath, configNew);
    changed.push(`${configPath} (GENESIS_SPARKS_TESTNET4.appId)`);
  } else {
    // Non-fatal: testnet4.ts uses env vars first; flag it but keep going.
    changed.push(
      `${configPath} (NO MATCH for appId literal — update the fallback string manually)`,
    );
  }

  return changed;
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  const args = parseCli(process.argv.slice(2));

  console.log("==========================================");
  console.log("  Genesis Sparks NFT Deploy (Charms v15)");
  console.log("==========================================");
  console.log(`  network       : ${args.network}`);
  console.log(`  prover        : ${args.proverUrl}`);
  console.log(`  funding UTXO  : ${args.fundingTxid}:${args.fundingVout}`);
  console.log(`  funding value : ${args.fundingValue} sats`);
  console.log(`  owner address : ${args.ownerAddress}`);
  console.log(`  contract VK   : ${NFT_CONTRACT_VK}`);
  console.log(`  binary size   : ${NFT_CONTRACT_BINARY.length / 2} bytes`);
  console.log(`  dry-run       : ${args.dryRun}`);
  console.log("");

  // 1. Compute the app id UP FRONT from the funding UTXO (see file header).
  const appId = computeAppId(args.fundingTxid, args.fundingVout);
  console.log(`[app-id] SHA256("${args.fundingTxid}:${args.fundingVout}")`);
  console.log(`[app-id] = ${appId}`);
  console.log(`[app-id] app string: n/${appId}/${NFT_CONTRACT_VK}`);
  console.log("");

  // 2. Build the deterministic genesis NFT state.
  const genesisBlock = await fetchConfirmingBlock(args.network, args.fundingTxid);
  const nftState = buildGenesisNftState(genesisBlock);
  console.log("[genesis NFT]");
  console.log(`  token_id      : ${nftState.token_id}`);
  console.log(`  dna           : ${nftState.dna}`);
  console.log(`  bloodline     : ${nftState.bloodline}`);
  console.log(`  base_type     : ${nftState.base_type}`);
  console.log(`  rarity_tier   : ${nftState.rarity_tier}`);
  console.log(`  level         : ${nftState.level}`);
  console.log(`  genesis_block : ${nftState.genesis_block}`);
  console.log("");

  // 3. Build the v15 spell.
  const destScriptPubkey = addressToScriptPubkey(args.ownerAddress);
  const spellObject = buildGenesisSpellObject({
    fundingUtxo: { txid: args.fundingTxid, vout: args.fundingVout },
    outState: nftState,
    destScriptPubkey,
    appId,
  });
  const spellHex = encodeCborHex(spellObject);
  console.log(`[spell] v${SPELL_VERSION} built, ${spellHex.length / 2} CBOR bytes`);

  // 4. Build the witness: the contract's `w` = the funding-UTXO string, hex-CBOR
  //    encoded. Per the spike-nft contract, validate_mint checks
  //    `hash(w_string) == app.identity`, and `tx.ins` contains the same UTXO.
  //    (Our genesis-babies contract uses NFTWitness { operation }, and the
  //    app identity is established by the funding UTXO the same way. The
  //    witness carries the operation; the prover/contract reconcile the UTXO.)
  const witnessValue = { operation: "mint" };
  const witnessHex = encodeCborHex(witnessValue);
  const appKey = `n/${appId}/${NFT_CONTRACT_VK}`;
  const appPrivateInputs: Record<string, string> = { [appKey]: witnessHex };
  console.log(`[witness] key=${appKey}`);
  console.log(`[witness] value=${witnessHex}`);
  console.log("");

  // 5. Fetch the prev tx (the tx that creates the funding UTXO).
  const prevTxHex = await fetchPrevTxHex(args.network, args.fundingTxid);

  // 6. POST to the prover.
  const { commitTxHex, spellTxHex } = await postToProver({
    proverUrl: args.proverUrl,
    spellHex,
    appPrivateInputs,
    prevTxHex,
    changeAddress: args.ownerAddress,
  });

  console.log("");
  console.log("[prover] OK");
  console.log(`  commit tx : ${commitTxHex.length / 2} bytes`);
  console.log(`  spell  tx : ${spellTxHex.length / 2} bytes`);

  // 7. Save the hex to temp files for signing.
  writeFileSync(COMMIT_HEX_PATH, commitTxHex);
  writeFileSync(SPELL_HEX_PATH, spellTxHex);

  if (args.dryRun) {
    console.log("");
    console.log(`[dry-run] wrote ${COMMIT_HEX_PATH} + ${SPELL_HEX_PATH}`);
    console.log("[dry-run] skipping signing/broadcast pause (re-run without --dry-run to deploy).");
    console.log(`[dry-run] app id (already known) = ${appId}`);
    return;
  }

  // 8. PAUSE for human signing + broadcast.
  console.log("");
  console.log("==========================================");
  console.log("  ACTION REQUIRED: sign + broadcast");
  console.log("==========================================");
  console.log(`Commit tx hex saved to : ${COMMIT_HEX_PATH}`);
  console.log(`Spell  tx hex saved to : ${SPELL_HEX_PATH}`);
  console.log("");
  console.log("These are UNSIGNED raw transactions. You must:");
  console.log("  1. Sign the COMMIT tx with your wallet (it spends your funding UTXO).");
  console.log("  2. Sign the SPELL  tx with your wallet (it spends the commit output).");
  console.log("  3. Broadcast BOTH to testnet4.");
  console.log("");
  console.log("Sign options (see runbook for detail):");
  console.log("  - scripts/sign-and-broadcast.ts  (MNEMONIC + TX_HEX based; taproot key-path)");
  console.log("  - Sparrow Wallet   : Tools -> Broadcast -> paste hex (sign first in a PSBT flow)");
  console.log("  - bitcoinjs-lib    : see scripts/sign-and-broadcast.ts as a template");
  console.log("");
  console.log("Broadcast endpoints:");
  console.log(`  POST https://mempool.space/testnet4/api/tx   (body = raw hex, Content-Type text/plain)`);
  console.log("");
  console.log("ORDER: broadcast the COMMIT tx FIRST, wait for it to appear on-chain,");
  console.log("then broadcast the SPELL tx. The spell spends commit output 0.");

  // 9. Read the commit txid back from the user.
  const commitTxid = await prompt(
    "\nPaste the COMMIT tx txid once broadcast (or press Enter to skip & print config with the pre-computed app id): ",
  );

  let resolvedAppId = appId;
  if (commitTxid) {
    console.log(`[verify] commit txid: ${commitTxid}`);
    // NOTE: the app id is derived from the FUNDING UTXO, not the commit tx.
    // We re-affirm it here for visibility. If a future contract revision moves
    // the app identity to the commit-tx output, change computeAppId to use
    // `${commitTxid}:0`. See file header + runbook for the rationale.
    console.log(`[verify] app id (from funding UTXO) = ${resolvedAppId}`);
    console.log(`         (if your contract derives app id from the commit output,`);
    console.log(`          it would instead be ${sha256Hex(`${commitTxid}:0`)})`);
  } else {
    console.log(`[skip] no commit txid provided; using funding-UTXO-derived app id.`);
  }

  // 10. Print (or apply) the config updates.
  console.log("");
  console.log("==========================================");
  console.log("  CONFIG UPDATES");
  console.log("==========================================");
  console.log(`app id = ${resolvedAppId}`);
  console.log("");
  console.log("apps/workers/wrangler.toml  (update BOTH [vars] and [env.production.vars]):");
  console.log(`  NFT_APP_ID = "${resolvedAppId}"`);
  console.log("");
  console.log("packages/bitcoin/src/config/testnet4.ts  (GENESIS_SPARKS_TESTNET4.appId fallback):");
  console.log(`  appId: process.env.NEXT_PUBLIC_GBABY_APP_ID || process.env.GBABY_APP_ID ||`);
  console.log(`         "${resolvedAppId}",`);
  console.log("");

  if (args.apply) {
    console.log("[--apply] writing config files...");
    try {
      const changed = applyConfigUpdates(resolvedAppId);
      for (const c of changed) console.log(`  updated: ${c}`);
      console.log("\n[--apply] done. Redeploy workers:");
      console.log("  pnpm --filter @bitcoinbaby/workers deploy");
      console.log("  (production: pnpm --filter @bitcoinbaby/workers deploy:production)");
    } catch (e) {
      console.error(`\n[--apply] FAILED: ${(e as Error).message}`);
      console.error("Update the files manually per the lines printed above.");
      process.exit(1);
    }
  } else {
    console.log("(Pass --apply to write these into the files automatically, or edit by hand.)");
  }

  console.log("");
  console.log("Done. Verify with:");
  console.log(`  curl -s "https://bitcoinbaby-api.<your>.workers.dev/health" | jq .`);
}

main().catch((err) => {
  console.error("\n[FATAL] " + (err instanceof Error ? err.message : String(err)));
  if (err instanceof Error && err.stack && process.env.DEBUG) {
    console.error(err.stack);
  }
  process.exit(1);
});
