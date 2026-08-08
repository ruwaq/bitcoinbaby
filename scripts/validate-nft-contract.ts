#!/usr/bin/env tsx
/**
 * E2E contract validation for the Genesis Sparks NFT contract.
 *
 * Proves (locally, no Bitcoin node / prover / Docker) that the genesis-babies
 * contract (`packages/bitcoin/contracts/genesis-babies/src/lib.rs`, compiled to
 * `.../target/wasm32-wasip1/release/genesis-babies.wasm`) CORRECTLY ACCEPTS the
 * spells our worker services build and CORRECTLY REJECTS invalid ones.
 *
 * Two complementary validation paths are run and both must be green:
 *
 *   PATH A — `charms spell check --mock` (YAML spell -> wasm, the real runtime):
 *     The mint operation is driven through the EXACT wasm the worker ships. This
 *     catches charm-data roundtrip bugs (snake_case field names, CBOR shape,
 *     `app_public_inputs` keying, witness routing) that pure Rust tests cannot.
 *     Each valid mint spell MUST be accepted (exit 0); each invalid variant MUST
 *     be rejected (non-zero exit / trap).
 *
 *   PATH B — `cargo test` (in-process `app_contract`, full coverage):
 *     `charms spell check --mock` cannot reach the work_proof / level_up paths,
 *     because resolving INPUT charm data requires an "enchanted" prev-tx (a bitcoin
 *     tx with the spell embedded in its taproot witness), which only a paid prover
 *     can produce. There is no free local mock-prove path for Bitcoin in charms v15.
 *     So work_proof / level_up / transfer / routing are validated in
 *     `packages/bitcoin/contracts/genesis-babies/tests/contract_integration.rs`,
 *     which calls the contract's real `app_contract(app, tx, x, w)` entry point
 *     with hand-built `Transaction` values — the same function the wasm runtime
 *     invokes. This covers every invalid variant the task lists.
 *
 * Usage:
 *   pnpm tsx scripts/validate-nft-contract.ts
 *   pnpm tsx scripts/validate-nft-contract.ts --no-cargo   # skip PATH B
 *
 * Exit code: 0 if every check is green, 1 otherwise (so it can gate CI).
 */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// =============================================================================
// PATHS
// =============================================================================

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const CONTRACT_DIR = join(
  REPO_ROOT,
  "packages",
  "bitcoin",
  "contracts",
  "genesis-babies",
);
const WASM = join(
  CONTRACT_DIR,
  "target",
  "wasm32-wasip1",
  "release",
  "genesis-babies.wasm",
);
const CHARMS =
  process.env.CHARMS_BIN ?? `${process.env.HOME}/.cargo/bin/charms`;

// =============================================================================
// DETERMINISTIC FIXTURE INPUTS
// =============================================================================
//
// `charms spell check --mock` derives the app identity from the prev-tx that
// creates the spent UTXO, and it requires `prev_txs` to contain a real parseable
// bitcoin tx whose txid matches the spent UTXO. We reuse the canonical v15
// scaffold prev-tx (a valid regtest-format segwit tx); its (witness-stripped)
// txid is `d8fa...f0`, so the spent UTXO is `d8fa...f0:0`. Mock mode does not
// verify the UTXO is actually spendable on-chain, only that the prev-tx creates
// it — which this one does.
//
// `app_id = SHA256("<funding_utxo>")`, per docs/superpowers/notes/charms-v15-witness-spike.md.
//
// The funding UTXO (prev-tx txid:vout) is DERIVED from the prev-tx hex at runtime
// (Bitcoin segwit txid = double-SHA256 of the witness-stripped serialization, then
// byte-reversed for display) rather than hardcoded, so the test fixture is self-
// consistent and no on-chain id is baked into the source.

const PREV_TX_HEX =
  "02000000000101a3a4c09a03f771e863517b8169ad6c08784d419e6421015e8c360db5231871eb0200000000fdffffff024331070000000000160014555a971f96c15bd5ef181a140138e3d3c960d6e1204e0000000000002251207c4bb238ab772a2000906f3958ca5f15d3a80d563f17eb4123c5b7c135b128dc0140e3d5a2a8c658ea8a47de425f1d45e429fbd84e68d9f3c7ff9cd36f1968260fa558fe15c39ac2c0096fe076b707625e1ae129e642a53081b177294251b002ddf600000000";
const PREV_TX_TXID = bitcoinSegwitTxid(PREV_TX_HEX);
const FUNDING_UTXO = `${PREV_TX_TXID}:0`;
const APP_ID = sha256Hex(FUNDING_UTXO);

// A valid P2TR script-pubkey dest (the scaffold's regtest/testnet dest; the
// contract never inspects `dest`, only `tx.outs` charm data, so any well-formed
// dest keeps `charms spell check` happy).
const DEST =
  "51208b9fa4a2faaf4d694781bceab550f9bbb38c6e3af32cdbd9823804dea2585ece";

// =============================================================================
// TYPES
// =============================================================================

interface MintFixture {
  /** Slug used for the temp filenames. */
  name: string;
  /** Human-readable description printed in the report. */
  description: string;
  /** Whether the contract is expected to ACCEPT this spell. */
  expectAccept: boolean;
  /** Partial NFT state; defaults below produce a valid fresh mint. */
  overrides: Partial<NftState>;
}

interface NftState {
  dna: string;
  bloodline: string;
  base_type: string;
  genesis_block: number;
  rarity_tier: string;
  token_id: number;
  level: number;
  xp: number;
  total_xp: number;
  work_count: number;
  last_work_block: number;
  evolution_count: number;
  tokens_earned: string;
  heritage: number;
}

interface CaseResult {
  name: string;
  description: string;
  expectAccept: boolean;
  accepted: boolean;
  pass: boolean;
  detail: string;
}

// =============================================================================
// CORE HELPERS
// =============================================================================

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** Decode a hex string into a byte array. */
function hexToBytes(hex: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    out.push(parseInt(hex.substring(i, i + 2), 16));
  }
  return out;
}

/** Read a Bitcoin varint from `bytes` at `pos`; returns [value, newPos]. */
function readVarint(bytes: number[], pos: number): [number, number] {
  const v = bytes[pos];
  pos += 1;
  if (v < 0xfd) return [v, pos];
  if (v === 0xfd) {
    return [bytes[pos] | (bytes[pos + 1] << 8), pos + 2];
  }
  if (v === 0xfe) {
    return [
      bytes[pos] |
        (bytes[pos + 1] << 8) |
        (bytes[pos + 2] << 16) |
        (bytes[pos + 3] << 24),
      pos + 4,
    ];
  }
  // 0xfd for 8-byte (won't be needed for these fixtures).
  throw new Error("8-byte varint not supported");
}

/**
 * Compute the txid of a segwit Bitcoin transaction: double-SHA256 of the
 * witness-stripped serialization (version + inputs + outputs + locktime, no
 * marker/flag/witness), then byte-reversed for display order. This mirrors what
 * `charms spell check` derives from `--prev-txs`, so the `FUNDING_UTXO` we use
 * in `tx.ins` matches the prev-tx we provide.
 */
function bitcoinSegwitTxid(txHex: string): string {
  const b = hexToBytes(txHex);
  let p = 0;
  const version = b.slice(p, (p += 4));
  const marker = b[p];
  const flag = b[p + 1];
  if (!(marker === 0x00 && flag !== 0)) {
    throw new Error("expected segwit tx (marker 0x00 + flag)");
  }
  p += 2;

  const stripped: number[] = [...version];

  const [inCount, ip] = readVarint(b, p);
  p = ip;
  pushVarint(stripped, inCount);
  for (let i = 0; i < inCount; i++) {
    stripped.push(...b.slice(p, (p += 36))); // prevout
    const [scriptLen, sp] = readVarint(b, p);
    pushVarint(stripped, scriptLen);
    p = sp;
    stripped.push(...b.slice(p, (p += scriptLen))); // scriptSig
    stripped.push(...b.slice(p, (p += 4))); // sequence
  }

  const [outCount, op] = readVarint(b, p);
  p = op;
  pushVarint(stripped, outCount);
  for (let i = 0; i < outCount; i++) {
    stripped.push(...b.slice(p, (p += 8))); // value
    const [scriptLen, sp] = readVarint(b, p);
    pushVarint(stripped, scriptLen);
    p = sp;
    stripped.push(...b.slice(p, (p += scriptLen))); // scriptPubKey
  }

  // Skip witness (everything between outputs and the 4-byte locktime at the end).
  const locktime = b.slice(b.length - 4);
  stripped.push(...locktime);

  const buf = Buffer.from(stripped);
  const hash = createHash("sha256")
    .update(createHash("sha256").update(buf).digest())
    .digest();
  return Buffer.from(hash).reverse().toString("hex");
}

/** Serialize a varint into `out` (handles the common <0xfd case used here). */
function pushVarint(out: number[], v: number): void {
  if (v < 0xfd) {
    out.push(v);
  } else if (v <= 0xffff) {
    out.push(0xfd, v & 0xff, (v >> 8) & 0xff);
  } else if (v <= 0xffffffff) {
    out.push(
      0xfe,
      v & 0xff,
      (v >> 8) & 0xff,
      (v >> 16) & 0xff,
      (v >> 24) & 0xff,
    );
  } else {
    out.push(
      0xff,
      v & 0xff,
      (v >> 8) & 0xff,
      (v >> 16) & 0xff,
      (v >> 24) & 0xff,
      0,
      0,
      0,
      0,
    );
  }
}

/** The canonical valid freshly-minted Spark (mirrors `valid_state()` in lib.rs). */
function freshMintState(): NftState {
  return {
    dna: "a".repeat(64),
    bloodline: "royal",
    base_type: "human",
    genesis_block: 100_000,
    rarity_tier: "common",
    token_id: 1,
    level: 1,
    xp: 0,
    total_xp: 0,
    work_count: 0,
    last_work_block: 0,
    evolution_count: 0,
    tokens_earned: "0",
    heritage: 0,
  };
}

/** Resolve the contract VK from the compiled wasm via `charms app vk`. */
function resolveAppVk(): string {
  if (!existsSync(WASM)) {
    throw new Error(
      `genesis-babies.wasm not found at ${WASM}.\n` +
        `Build it first:\n  cd ${CONTRACT_DIR} && cargo build --release --target wasm32-wasip1`,
    );
  }
  const r = spawnSync(CHARMS, ["app", "vk", WASM], {
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(
      `charms app vk failed (status ${r.status}):\n${r.stderr || r.stdout}`,
    );
  }
  return r.stdout.trim();
}

// =============================================================================
// YAML SPELL BUILDERS
// =============================================================================

/** Render an NFT state as the YAML map `charms spell check` expects under `outs`. */
function stateToYaml(s: NftState, indent: string): string {
  const lines: string[] = [];
  lines.push(`${indent}dna: ${s.dna}`);
  lines.push(`${indent}bloodline: ${s.bloodline}`);
  lines.push(`${indent}base_type: ${s.base_type}`);
  lines.push(`${indent}genesis_block: ${s.genesis_block}`);
  lines.push(`${indent}rarity_tier: ${s.rarity_tier}`);
  lines.push(`${indent}token_id: ${s.token_id}`);
  lines.push(`${indent}level: ${s.level}`);
  lines.push(`${indent}xp: ${s.xp}`);
  lines.push(`${indent}total_xp: ${s.total_xp}`);
  lines.push(`${indent}work_count: ${s.work_count}`);
  lines.push(`${indent}last_work_block: ${s.last_work_block}`);
  lines.push(`${indent}evolution_count: ${s.evolution_count}`);
  lines.push(`${indent}tokens_earned: "${s.tokens_earned}"`);
  lines.push(`${indent}heritage: ${s.heritage}`);
  return lines.join("\n");
}

/**
 * Build the spell YAML for a mint, mirroring `buildMintSpell` in
 * `apps/workers/src/services/nft-minting-simple.ts` (same version, same `tx`
 * shape, same `app_public_inputs` key), but in the YAML form `charms spell check`
 * reads. The NFT state goes into `tx.outs[0]` under app index `0` (the single
 * app passed via `--app-bins`); the contract reads it via `charm_values`.
 */
function buildMintSpellYaml(state: NftState, appVk: string): string {
  const appKey = `n/${APP_ID}/${appVk}`;
  return `version: 15

tx:
  ins:
    - ${FUNDING_UTXO}
  outs:
    - 0:
${stateToYaml(state, "        ")}
  coins:
    - amount: 330
      dest: ${DEST}

app_public_inputs:
  "${appKey}": ~
`;
}

/** Private-inputs file: the witness `w` (operation name only, for a mint). */
function buildMintPrivateYaml(appVk: string): string {
  const appKey = `n/${APP_ID}/${appVk}`;
  return `"${appKey}":\n  operation: mint\n`;
}

// =============================================================================
// SPELL CHECK RUNNER
// =============================================================================

interface SpellCheckResult {
  accepted: boolean;
  stdout: string;
  stderr: string;
}

function runSpellCheck(
  spellPath: string,
  privateInputsPath: string,
  appVk: string,
): SpellCheckResult {
  // Sanity-check the wasm exists (the helper already threw earlier, but be safe).
  const r = spawnSync(
    CHARMS,
    [
      "spell",
      "check",
      "--spell",
      spellPath,
      "--app-bins",
      WASM,
      "--private-inputs",
      privateInputsPath,
      "--prev-txs",
      PREV_TX_HEX,
      "--mock",
    ],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  );
  // The contract uses `check!`, which panics (trap) on a failed assertion. The
  // CLI reports that as a non-zero exit + a panic message on stderr. Exit 0 with
  // the "app contract satisfied" line means accepted.
  const combined = `${r.stdout}\n${r.stderr}`;
  const accepted = r.status === 0 && /app contract satisfied/.test(combined);
  return { accepted, stdout: r.stdout, stderr: r.stderr };
}

// =============================================================================
// FIXTURES — the mint matrix
// =============================================================================

const MINT_FIXTURES: MintFixture[] = [
  {
    name: "mint_valid",
    description: "valid genesis mint (token_id 1, royal/human/common, level 1)",
    expectAccept: true,
    overrides: {},
  },
  {
    name: "mint_token_id_zero",
    description: "token_id = 0 (below supply floor of 1)",
    expectAccept: false,
    overrides: { token_id: 0 },
  },
  {
    name: "mint_token_id_over_cap",
    description: "token_id = 10001 (above MAX_SUPPLY 10000)",
    expectAccept: false,
    overrides: { token_id: 10001 },
  },
  {
    name: "mint_invalid_bloodline",
    description: "bloodline = peasant (not royal|warrior|rogue|mystic)",
    expectAccept: false,
    overrides: { bloodline: "peasant" },
  },
  {
    name: "mint_invalid_base_type",
    description: "base_type = dragon (not in valid set)",
    expectAccept: false,
    overrides: { base_type: "dragon" },
  },
  {
    name: "mint_invalid_rarity",
    description: "rarity_tier = ultra (not in valid set)",
    expectAccept: false,
    overrides: { rarity_tier: "ultra" },
  },
  {
    name: "mint_level_not_one",
    description: "level = 2 (a fresh mint must start at level 1)",
    expectAccept: false,
    overrides: { level: 2 },
  },
  {
    name: "mint_bad_dna",
    description: "dna = 64 'z' chars (non-hex)",
    expectAccept: false,
    overrides: { dna: "z".repeat(64) },
  },
  {
    name: "mint_tokens_earned_nonzero",
    description: 'tokens_earned = "5" (a fresh mint holds no lifetime rewards)',
    expectAccept: false,
    overrides: { tokens_earned: "5" },
  },
];

// =============================================================================
// CARGO TEST RUNNER (PATH B)
// =============================================================================

interface CargoTestResult {
  passed: boolean;
  summary: string;
  detail: string;
}

function runCargoIntegrationTests(): CargoTestResult {
  // Run BOTH the contract's own unit tests (pure helpers) and the integration
  // suite (full `app_contract` over mint/work_proof/level_up/transfer + every
  // invalid variant). `--no-fail-fast` so we see every failure, not just the
  // first. The contract crate is its own workspace, so cwd must be CONTRACT_DIR.
  const r = spawnSync(
    "cargo",
    [
      "test",
      "--no-fail-fast",
      "--manifest-path",
      join(CONTRACT_DIR, "Cargo.toml"),
    ],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  const combined = `${r.stdout}\n${r.stderr}`;
  // Each test binary prints a "test result: ok. N passed; M failed; ..." line.
  // Aggregate across all binaries. Match only up to the end of that line so we
  // count every binary (unit tests, integration tests, doc tests).
  const resultLines = [
    ...combined.matchAll(
      /test result: (ok|FAILED)\. (\d+) passed; (\d+) failed[^\n]*/g,
    ),
  ];
  let totalPassed = 0;
  let totalFailed = 0;
  for (const m of resultLines) {
    totalPassed += parseInt(m[2], 10);
    totalFailed += parseInt(m[3], 10);
  }
  const anyFailures = /test result: FAILED/.test(combined);
  const passed = r.status === 0 && !anyFailures && totalFailed === 0;
  const summary = `${totalPassed} passed, ${totalFailed} failed across ${resultLines.length} test bin(s)`;
  return { passed, summary, detail: combined };
}

// =============================================================================
// REPORTING
// =============================================================================

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function color(s: string, c: string): string {
  if (!process.stdout.isTTY) return s;
  return `${c}${s}${RESET}`;
}

function printResult(r: CaseResult): void {
  const tag = r.pass ? color("PASS", GREEN) : color("FAIL", RED);
  const expect = r.expectAccept ? "accept" : "reject";
  const got = r.accepted ? "accepted" : "rejected";
  const verdict = r.pass
    ? color(`(expected ${expect}, ${got})`, DIM)
    : color(`(expected ${expect}, but ${got})`, YELLOW);
  console.log(`  ${tag}  ${r.name.padEnd(28)} ${verdict}`);
  if (!r.pass) {
    console.log(
      color(
        `        ${r.detail.split("\n").slice(0, 3).join("\n        ")}`,
        DIM,
      ),
    );
  }
}

// =============================================================================
// MAIN
// =============================================================================

function main(): void {
  const { values } = parseArgs({
    options: {
      "no-cargo": { type: "boolean", default: false },
    },
  });

  console.log(color("Genesis Sparks NFT contract validation\n", BOLD));
  console.log(`contract:  ${CONTRACT_DIR}`);
  console.log(`wasm:      ${WASM}`);
  console.log(`app_id:    ${APP_ID}`);
  console.log(`funding:   ${FUNDING_UTXO}  (prev_tx txid, mock)\n`);

  // --- Preflight -----------------------------------------------------------
  const appVk = resolveAppVk();
  console.log(`app_vk:    ${appVk}\n`);

  const tmpDir = mkdtempSync(join(tmpdir(), "nft-validate-"));

  // --- PATH A: spell check on the mint matrix ------------------------------
  console.log(
    color("PATH A — charms spell check --mock  (YAML spell -> wasm)", CYAN),
  );
  console.log(
    color(
      "         covers: mint (valid + invalid), charm-data roundtrip\n",
      DIM,
    ),
  );

  const spellResults: CaseResult[] = [];
  for (const fx of MINT_FIXTURES) {
    const state: NftState = { ...freshMintState(), ...fx.overrides };
    const spellPath = join(tmpDir, `${fx.name}.yaml`);
    const privatePath = join(tmpDir, `${fx.name}.private.yaml`);
    writeFileSync(spellPath, buildMintSpellYaml(state, appVk));
    writeFileSync(privatePath, buildMintPrivateYaml(appVk));

    const { accepted, stdout, stderr } = runSpellCheck(
      spellPath,
      privatePath,
      appVk,
    );
    const pass = accepted === fx.expectAccept;
    const detail =
      stdout.trim() ||
      stderr
        .trim()
        .split("\n")
        .filter((l) => /panic|assertion|Error|satisfied/i.test(l))
        .join("\n") ||
      stderr.trim().slice(0, 200);
    const res: CaseResult = {
      name: fx.name,
      description: fx.description,
      expectAccept: fx.expectAccept,
      accepted,
      pass,
      detail,
    };
    spellResults.push(res);
    printResult(res);
  }

  const spellValid = spellResults.filter((r) => r.expectAccept);
  const spellInvalid = spellResults.filter((r) => !r.expectAccept);
  const spellValidAccepted = spellValid.filter((r) => r.accepted).length;
  const spellInvalidRejected = spellInvalid.filter((r) => !r.accepted).length;
  const spellAllPass = spellResults.every((r) => r.pass);

  console.log(
    `\n  mint summary: ${spellValidAccepted}/${spellValid.length} valid accepted, ` +
      `${spellInvalidRejected}/${spellInvalid.length} invalid rejected\n`,
  );

  // --- PATH B: cargo test (in-process app_contract) ------------------------
  let cargoAllPass = true;
  let cargoSummary = "(skipped)";
  if (!values["no-cargo"]) {
    console.log(
      color("PATH B — cargo test  (in-process app_contract entry point)", CYAN),
    );
    console.log(
      color(
        "         covers: mint + work_proof + level_up + transfer + routing\n",
        DIM,
      ),
    );
    const cargo = runCargoIntegrationTests();
    cargoAllPass = cargo.passed;
    cargoSummary = cargo.summary;
    console.log(
      `  ${cargoAllPass ? color("PASS", GREEN) : color("FAIL", RED)}  cargo test   ${color(
        cargoSummary,
        DIM,
      )}\n`,
    );
    if (!cargoAllPass) {
      // Surface the failing test names.
      const fails = [
        ...cargo.detail.matchAll(/^test (\S+) \.\.\. FAILED/gm),
      ].map((m) => m[1]);
      if (fails.length) {
        console.log(color("        failing tests:", YELLOW));
        for (const f of fails) console.log(color(`          - ${f}`, YELLOW));
      }
    }
  }

  // --- Final verdict -------------------------------------------------------
  const allGreen = spellAllPass && cargoAllPass;
  console.log(color("─".repeat(64), DIM));
  if (allGreen) {
    console.log(
      color("ALL GREEN", GREEN) +
        `  — ${spellValidAccepted} valid mint accepted, ` +
        `${spellInvalidRejected} invalid mint rejected; cargo: ${cargoSummary}`,
    );
  } else {
    console.log(color("VALIDATION FAILED", RED));
    if (!spellAllPass) {
      const bad = spellResults.filter((r) => !r.pass);
      console.log(
        color(
          `  spell-check failures: ${bad.map((r) => r.name).join(", ")}`,
          RED,
        ),
      );
    }
    if (!cargoAllPass) {
      console.log(color(`  cargo test: ${cargoSummary}`, RED));
    }
  }

  process.exit(allGreen ? 0 : 1);
}

try {
  main();
} catch (e) {
  console.error(color("FATAL:", RED), e instanceof Error ? e.message : e);
  process.exit(2);
}
