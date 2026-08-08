# Charms v15 Witness Plumbing — Spike (Task 0.2)

**Status:** AUTHORITATIVE — verified against SDK source + generated prover payload.
**Date:** 2026-08-08
**Charms CLI / SDK:** v15.0.0 (`~/.cargo/bin/charms`)
**Branch:** `feat/testnet4-profesional-nft`

This spike resolves how a Charms v15 spell delivers the witness `w` (the 4th argument of
`app_contract`) and the public input `x` (the 3rd argument) to the on-chain contract. It is the
gate for every spell the worker builds and for the contract we revive from commit `90cee8b`.

---

## TL;DR (the answers the plan needs)

1. **Witness field name (`w`):** `app_private_inputs`. It is a **separate top-level field of the
   Prover API request body**, NOT a field inside the spell. Its value is a map keyed by the full
   app string `"n/<app_id>/<app_vk>"` → hex-encoded CBOR of the witness `Data`.
2. **Public input field name (`x`):** `app_public_inputs`. It lives **inside the spell** (inside
   `spell.tx.app_public_inputs` in the SDK `Transaction` struct). Keyed the same way:
   `"n/<app_id>/<app_vk>"` → CBOR `Data` (commonly `null` / empty).
3. **The `90cee8b` pattern still works.** `match w.value::<NFTWitness>() { Ok(w) => ...,
   Err(_) => transfer }` is valid v15. `Data::value::<T>()` returns `anyhow::Result<T>`, so the
   `Err` arm fires when no `app_private_inputs` is supplied for that app. Correct idiom.
4. **The current worker (`nft-minting-simple.ts`) is missing `app_private_inputs` entirely.**
   That is the bug. It must be added as a sibling of `spell`, `binaries`, `prev_txs`.
5. **There is NO `nft_remaining` helper in v15.** Do not use it. The helpers that exist are
   `nft_state_preserved`, `charm_values`, `sum_token_amount`, `is_simple_transfer`,
   `token_amounts_balanced`, and the `check!` / `app_version!` macros (signatures below).

---

## 1. Witness field name (the `w` argument) — `app_private_inputs`

**Field name:** `app_private_inputs`

**Where it goes:** It is a **top-level field of the Prover API request body**, alongside `spell`,
`binaries`, `prev_txs`, `change_address`, `fee_rate`, `chain`. It is deliberately kept OUT of the
published spell so the witness is never published on-chain.

**Type / shape:**
```json
"app_private_inputs": {
  "n/<app_id_hex>/<app_vk_hex>": "<hex-encoded CBOR of the witness Data>"
}
```

**Evidence (ground-truth prover payload, generated via `charms spell prove --payload --mock`):**
```
{
  "spell": "a36776657273696f6e0f...f6",
  "app_private_inputs": {
    "n/8fed59719e6f4f509691bf5589888d3bde168b34904a952e70b1024d163297a8/a37cf5ff576360c09998ebfe3a41f31634227b3a1809d8afdbfd0351909fb1a8":
      "7842643866613463646164653761633364666636343034376463373362353835393165626536333835373938383162323030643466656136386663383435323166303a30"
  },
  "binaries": { "<app_vk_hex>": "<base64 wasm>" },
  "change_address": "...", "fee_rate": 2.0, "chain": "bitcoin"
}
```
The witness value above decodes (CBOR major-type-3 text string, `0x78 0x42` = 66-byte string) to
`"d8fa4cdade7ac3dff64047dc73b58591ebe638579881b200d4fea68fc84521f0:0"` — exactly the UTXO id the
template contract reads via `let w_str: Option<String> = w.value().ok();`.

**SDK source confirmation** (`charms-data-15.0.0/src/lib.rs`, struct `AppInput`):
```rust
pub struct AppInput {
    pub app_binaries: BTreeMap<B32, Vec<u8>>,
    pub app_private_inputs: BTreeMap<App, Data>,   // <-- keyed by full App
    #[serde(skip_serializing_if = "BTreeMap::is_empty", default)]
    pub app_signatures: BTreeMap<B32, AppSignature>,
}
```
Note the key type is `App` (the full `tag/identity/vk` string), NOT just the VK. The CLI payload
above confirms it serializes to the `"n/<app_id>/<app_vk>"` string form. (The Prover API docs page
shows a sloppy example keyed only by VK — that example is wrong; trust the SDK struct + the real
generated payload, both of which key by the full app string.)

---

## 2. Public input field name (the `x` argument) — `app_public_inputs`

**Field name:** `app_public_inputs`

**Where it goes:** **Inside the spell.** Specifically it is a field of the SDK `Transaction`
struct, so in the CBOR/JSON spell it appears under `tx.app_public_inputs` in the logical (YAML)
form, and is flattened into the spell map by the prover.

**SDK source confirmation** (`charms-data-15.0.0/src/lib.rs`, struct `Transaction`):
```rust
pub struct Transaction {
    pub ins:  Vec<(UtxoId, Charms)>,
    pub refs: Vec<(UtxoId, Charms)>,
    pub outs: Vec<Charms>,
    pub coin_ins:  Option<Vec<NativeOutput>>,
    pub coin_outs: Option<Vec<NativeOutput>>,
    pub prev_txs: BTreeMap<TxId, Data>,
    pub app_public_inputs: BTreeMap<App, Data>,   // <-- the public input x, keyed by App
}
```
**Important nuance:** In the YAML/JSON spell the worker emits, the worker places
`app_public_inputs` as a **sibling of `tx`** (not nested inside `tx`). This is what the v15
template's `mint-nft.yaml` does, and it is what the current worker already does. The prover
normalizes it into the `Transaction` struct. Keep it as a sibling of `tx` in the spell object.

**Shape (inside the spell):**
```yaml
app_public_inputs:
  "n/<app_id>/<app_vk>": ~     # null = empty public input (Data::empty())
```
The value is the CBOR `Data` for `x`. `~` / `null` deserializes to `Data::empty()` (which is what
`Data::value()` returns as `Null`). The template contract asserts `x == &Data::empty()`.

---

## 3. Confirmed v15 helpers — exact signatures

All taken verbatim from `charms-data-15.0.0/src/lib.rs` and `charms-sdk-15.0.0/src/lib.rs`. Import
them from `charms_sdk::data::{...}` inside a contract.

### `check!` macro
```rust
#[macro_export]
macro_rules! check {
    ($condition:expr) => {
        if !$condition {
            eprintln!("condition does not hold: {}", stringify!($condition));
            return false;        // returns false from the enclosing fn (must return bool)
        }
    };
}
```
Usage: `check!(app.tag == NFT);` — returns `false` early from the contract fn on failure and logs
the failing expression. There is NO message form in v15.0.0; only `check!(cond)`.

### `nft_state_preserved`
```rust
pub fn nft_state_preserved(app: &App, tx: &Transaction) -> bool
```
Returns `true` iff the multiset of NFT states for `app` in `tx.ins` equals that in `tx.outs`
(i.e. the NFTs moved unchanged). Use this for the transfer/"state unchanged" branch.

### `charm_values`
```rust
pub fn charm_values<'a>(
    app: &'a App,
    strings_of_charms: impl Iterator<Item = &'a Charms>,
) -> impl Iterator<Item = &'a Data>
```
Iterates the `Data` for `app` across a set of charms (use `tx.outs.iter()`, or
`tx.ins.iter().map(|(_, v)| v)` for inputs). (`app_datas` is the same thing but `#[deprecated]`.)

### `sum_token_amount`
```rust
pub fn sum_token_amount<'a>(
    app: &App,
    strings_of_charms: impl Iterator<Item = &'a Charms>,
) -> anyhow::Result<u64>
```
Sums token amounts. `ensure!(app.tag == TOKEN)` internally; errors if a charm value isn't a `u64`.

### `is_simple_transfer` / `token_amounts_balanced` (also available)
```rust
pub fn is_simple_transfer(app: &App, tx: &Transaction) -> bool   // TOKEN -> balanced, NFT -> state_preserved
pub fn token_amounts_balanced(app: &App, tx: &Transaction) -> bool
```

### `app_version!` macro  (SDK, `charms-sdk-15.0.0/src/lib.rs`)
```rust
#[macro_export]
macro_rules! app_version {
    ($version:expr) => {
        pub const VERSION: u32 = $version;
        #[unsafe(no_mangle)]
        pub extern "C" fn __app_version() -> u32 { VERSION }
    };
}
```
Usage: `charms_sdk::app_version!(1);` exactly once at the top of the contract crate. **Requires
edition 2024** (the `#[unsafe(no_mangle)]` spelling). Only needed for *versioned* apps; for an
immutable single-deploy app it is optional but harmless.

### `main!` macro (SDK) — what wires `(app, tx, x, w)` into your `app_contract`
```rust
#[macro_export]
macro_rules! main {
    ($path:path) => {
        fn main() {
            use charms_sdk::data::{App, Data, Transaction};
            let (app, tx, x, w): (App, Transaction, Data, Data) =
                charms_sdk::data::util::read(std::io::stdin())
                    .expect("should deserialize (app, tx, x, w)");
            assert!($path(&app, &tx, &x, &w));
        }
    };
}
```
This is the authoritative proof of argument order: **`app_contract(app, tx, x, w)`** with
`x` = public input, `w` = private witness. (`main.rs` is just `charms_sdk::main!(my_app::app_contract);`.)

### `Data` (the type of `x` and `w`)
```rust
pub struct Data(ciborium::Value);   // wraps a CBOR value
impl Data {
    pub fn empty() -> Self                              // Null
    pub fn is_empty(&self) -> bool
    pub fn value<T: DeserializeOwned>(&self) -> anyhow::Result<T>   // <-- w.value::<NFTWitness>()
    pub fn bytes(&self) -> Vec<u8>
    pub fn try_from_bytes(bytes: &[u8]) -> anyhow::Result<Self>
}
```

> **`nft_remaining` DOES NOT EXIST in v15.0.0.** Grep of the entire `charms-data-15.0.0/src/`
> crate returns zero hits. The docs page hallucinated it. If you need "remaining supply" logic
> (like the template's token contract), read it yourself from the NFT state via
> `charm_values(...).find_map(|d| d.value::<YourNftContent>().ok())` and compare `remaining` —
> exactly as the v15 template `can_mint_token` already does.

---

## 4. Does the `90cee8b` pattern still work? — YES

The contract at `packages/bitcoin/contracts/genesis-babies/src/lib.rs` (as of commit `90cee8b`)
uses:

```rust
let witness: NFTWitness = match w.value() {
    Ok(w) => w,
    Err(_) => {
        // No witness = transfer, use built-in check
        return nft_state_preserved(app, tx);
    }
};
match witness.operation.as_str() {
    "mint" => validate_mint(app, tx, x),
    "transfer" => nft_state_preserved(app, tx),
    _ => true,
}
```

**Verdict: this is valid and is the correct v15 idiom.** Reasoning, point by point:

- `w.value::<NFTWitness>()` calls `Data::value::<T: DeserializeOwned>(&self) -> Result<T>`. It
  returns `Err` when `w` is empty (`Data::empty()` → `Null`) OR when the CBOR does not deserialize
  into `NFTWitness`. So `Err(_) => transfer` correctly catches "the spell sent no witness for this
  app".
- `nft_state_preserved(app, tx)` is a real v15 helper with exactly the signature used.
- The `match app.tag` / `check!(app.tag == NFT)` style matches the v15 template.
- One small caveat: the `90cee8b` `NFTWitness` only carries `operation: String`. That is fine for
  routing. Any mint-validation data that must be visible on-chain must instead go through `x`
  (public input) — which the `90cee8b` `validate_mint` already does (`x.value::<BabyNFTState>()`).

**The only reason it currently fails in production is NOT the contract pattern — it is that the
worker never sends `app_private_inputs`.** Because `w` arrives empty, `w.value()` always errors,
so every operation silently falls into the `transfer` branch. That is exactly the bug this spike
exists to fix. The fix is on the worker side (Section 7), not the contract side.

> Note: the contract currently checked into `HEAD` on this branch is a *debug stub* that just does
> `check!(x.is_empty())` and accepts everything (SDK v11). The `90cee8b` version is the real
> contract to revive. When reviving it, bump its `Cargo.toml` to `charms-sdk = "15.0.0"` and
> `edition = "2024"` to match the v15 template.

---

## 5. The spell shape — concrete examples

### 5a. Full Prover API request body (single-app NFT mint, with witness)

This is the JSON the worker must POST to `https://v15.charms.dev/spells/prove`. `spell` is a
hex-encoded CBOR string; `app_private_inputs` and `binaries` are siblings of `spell`:

```json
{
  "spell": "<hex CBOR of {version, tx, app_public_inputs}>",
  "app_private_inputs": {
    "n/<app_id_hex>/<app_vk_hex>": "<hex CBOR of witness Data>"
  },
  "binaries": {
    "<app_vk_hex>": "<base64 of app .wasm>"
  },
  "prev_txs": [
    { "bitcoin": "<hex of prev tx that creates the spent UTXO>" }
  ],
  "change_address": "tb1p...",
  "fee_rate": 2.0,
  "chain": "bitcoin"
}
```

### 5b. The logical spell (what the `spell` field decodes to)

```
{
  version: 15,
  tx: {
    ins:   [ <36-byte UTXO id> ],
    outs:  [ { 0: <NFT state map> } ],
    coins: [ { amount: 330, dest: <script-pubkey bytes> } ]
  },
  app_public_inputs: {
    "n/<app_id>/<app_vk>": null            // <- x, the public input (empty/null here)
  }
}
```
Note: `app_public_inputs` is present inside the spell; `app_private_inputs` is NOT — it travels
separately (Section 1).

### 5c. Equivalent YAML (CLI form) — for cross-checking with the scaffold

`spells/mint-nft.yaml` (public spell):
```yaml
version: 15
tx:
  ins:  [ "${in_utxo_0}" ]
  outs: [ { 0: { ticker: SPIKE-NFT, remaining: 100000 } } ]
  coins: [ { amount: ${amount_0}, dest: ${dest_0} } ]
app_public_inputs:
  "n/${app_id}/${app_vk}": ~
```
`spells/mint-nft-private.yaml` (private inputs file, passed via `--private-inputs`):
```yaml
"n/${app_id}/${app_vk}": "${in_utxo_0}"
```
The CLI merges these: the YAML key `n/<id>/<vk>` → value becomes the hex-CBOR witness in
`app_private_inputs`; the `app_public_inputs` from the spell stays in the spell.

### 5d. Structured witness (what we actually need for NFT operations)

For our contract, `w` should deserialize into `NFTWitness { operation: String, ... }`. The
`app_private_inputs` value is therefore the hex-CBOR of that struct, e.g. for a mint:

```
key:   "n/<app_id_hex>/<app_vk_hex>"
value: hex( cbor( { "operation": "mint" } ) )
```
CBOR of `{"operation":"mint"}` = `a167 6f70 6572 6174 696f 6e 64 6d696e74` → as a map(1) with
text-key "operation" and text-value "mint". The worker must produce this with the same CBOR encoder
it already uses for the spell (`cbor2`), then hex-encode the result.

### 5e. Two-app tx (NFT + TOKEN), both needing inputs

```json
{
  "spell": "<hex CBOR>",
  "app_private_inputs": {
    "n/<app_id>/<nft_vk>": "<hex CBOR of NFTWitness>",
    "t/<app_id>/<tok_vk>": "<hex CBOR of TokenWitness>"
  },
  "app_public_inputs": {
    "n/<app_id>/<nft_vk>": null,
    "t/<app_id>/<tok_vk>": null
  },
  ...
}
```
(`app_public_inputs` shown here as it would appear in the decoded spell; `app_private_inputs` is
top-level in the request.)

---

## 6. Breaking changes / contradictions vs `90cee8b` and the current worker

### vs the current worker (`apps/workers/src/services/nft-minting-simple.ts`)
- **MISSING `app_private_inputs` (the bug).** `buildMintSpell` (lines ~219-232) builds only
  `{ version, tx, app_public_inputs }` into the spell and returns `{ spell, funding_utxo,
  funding_utxo_value, change_address, chain, fee_rate }`. The `processMint` method (lines ~124-130)
  then spreads `...spellData` and adds only `prev_txs` and `binaries`. **`app_private_inputs` is
  never set anywhere.** Result: `w` is always empty → contract always treats the op as a transfer.
- **`version: 11` in the spell** (line 220). The v15 prover expects `version: 15` (the v15 template
  spells all use `version: 15`). Should be bumped to `15`.
- **`app_public_inputs` value is `null`** (line 213, `appPublicInputs.set(appTuple, null)`). This is
  correct for an empty public input, BUT it means the contract's `x` is empty. If the revived
  `90cee8b` contract's `validate_mint` wants to read `BabyNFTState` from `x`, the worker must put
  the NFT state into `app_public_inputs` instead of (or in addition to) the charm output. Decide
  per the design; for a pure mint where the NFT state is in the charm output, leaving `x` empty is
  fine and `validate_mint` should read from `tx.outs` via `charm_values`, not from `x`.
- **App key encoding.** The worker builds the key as a tuple
  `["n", identityBytes, vkBytes]` (lines 207-213). The SDK `App` in non-human-readable (CBOR)
  form is indeed a 3-tuple `(tag: char, identity: B32, vk: B32)`, and in CBOR a `char` is a
  single-char string — so `["n", <32 bytes>, <32 bytes>]` is correct for the CBOR spell. For the
  **`app_private_inputs` JSON object key**, however, the CLI uses the **string form**
  `"n/<id>/<vk>"`. The worker currently only emits the tuple form (inside the CBOR spell) and has
  no `app_private_inputs` map at all. The fix must emit the **string** key for the
  `app_private_inputs` map (see Section 7).

### vs the `90cee8b` contract
- **API surface is unchanged.** `app_contract(app, tx, x, w)`, `w.value::<T>()`,
  `nft_state_preserved`, `check!` all behave identically. No rewrite needed.
- **Cargo deps need bumping.** The `90cee8b` `genesis-babies/Cargo.toml` is not pinned to v15; the
  version currently in `HEAD` is `charms-sdk = "11.0"` / `edition = "2021"`. To compile under v15
  toolchain and (optionally) use `app_version!`, set `charms-sdk = "15.0.0"` and `edition = "2024"`.
- **`nft_remaining` is not available** — but the `90cee8b` contract does not use it, so no impact.
- **No `app_version!` in `90cee8b`.** That is fine for an immutable app. Add it only if we adopt
  versioned apps.

### Other v15 notes
- The `Transaction` struct gained `coin_ins` / `coin_outs` (native-coin amounts) and `refs`
  (reference UTXOs) — optional, `skip_serializing_if = Option::is_none"`. The worker's current
  `tx.coins` field is the v11 spelling; v15 spells in the template use `tx.coins` too (it maps to
  `coin_outs`), so this is compatible. No action required for this spike, but be aware the SDK
  field names are `coin_ins`/`coin_outs`.
- `versioned_apps` is an optional top-level spell field for signed, upgradeable apps. Omit it for
  our single-deploy NFT app.

---

## 7. Recommendation — exact worker change

In `apps/workers/src/services/nft-minting-simple.ts`, add `app_private_inputs` to the prover
request. Concretely:

1. **Add a witness builder.** Near `buildMintSpell`, add a helper that produces the CBOR-hex
   witness for a given operation:
   ```ts
   private buildWitnessHex(operation: string): string {
     const witness = { operation };            // matches NFTWitness { operation: String }
     const bytes = cbor.encode(witness);        // cbor2, same encoder used for the spell
     return this.bytesToHex(new Uint8Array(bytes));
   }
   ```

2. **Return the witness from `buildMintSpell`** (or build it in `processMint`). Use the **string**
   app key `"n/<app_id>/<app_vk>"` (NOT the tuple):
   ```ts
   const appKey = `n/${this.appId}/${NFT_CONTRACT_VK}`;
   const app_private_inputs = {
     [appKey]: this.buildWitnessHex("mint"),
   };
   ```

3. **Include it in the prover request** in `processMint` (alongside `prev_txs` and `binaries`):
   ```ts
   const proverRequest = {
     ...spellData,
     app_private_inputs,        // <-- NEW, top-level, sibling of spell/binaries/prev_txs
     prev_txs: [{ bitcoin: prevTxHex }],
     binaries: { [NFT_CONTRACT_VK]: NFT_CONTRACT_BINARY },
   };
   ```

4. **Bump spell `version` to `15`** (line 220): `version: 15`.

5. **Per-operation witnesses.** When the worker later builds `work_proof` / `level_up` / `transfer`
   spells, set the witness `operation` field accordingly (`"work_proof"`, `"level_up"`,
   `"transfer"`). For `"transfer"`, you may omit `app_private_inputs` entirely and let the
   contract's `Err(_) => nft_state_preserved(...)` branch handle it — that is the idiomatic way to
   signal "no custom logic, just move the NFT".

6. **(Optional, for mint validation via public input.)** If we want the contract to validate the
   mint payload that is visible on-chain, put the `BabyNFTState` into `app_public_inputs` (replace
   the `null` value at line 213 with the CBOR-hex of the state) and have `validate_mint` read it
   from `x`. Otherwise leave `x` empty and validate via `charm_values(app, tx.outs.iter())`. Pick
   one and be consistent; do not put secret data in `x` (it is published).

### Acceptance check (post-change)
After the change, a mint spell POST should no longer be misrouted: the contract's
`w.value::<NFTWitness>()` will succeed with `operation = "mint"` and execute `validate_mint`
instead of falling through to `nft_state_preserved`. You can confirm the wire format locally with:
```sh
charms spell prove --payload --mock \
  --spell spell.yaml --private-inputs priv.yaml \
  --app-bins app.wasm --change-address <addr> --fee-rate 2.0 --chain bitcoin
```
and diff the emitted `app_private_inputs` against what the worker now produces.

---

## Appendix — how this was verified

- Scaffolded a fresh v15 app: `charms app new spike-nft` (in `/tmp/spike-nft`). Template contract
  `src/lib.rs` uses `app_contract(app, tx, x, w)`, `check!`, `charm_values`, `sum_token_amount`,
  `Data::value`, and reads `w` as a UTXO-id string. `Cargo.toml` pins `charms-sdk = "15.0.0"`,
  `edition = "2024"`.
- Read the authoritative SDK source after `cargo build`:
  - `charms-data-15.0.0/src/lib.rs` — `Transaction`, `AppInput`, `App`, `Data`, `check!`,
    `nft_state_preserved`, `charm_values`, `sum_token_amount`, `is_simple_transfer`,
    `token_amounts_balanced`. Grep confirmed `nft_remaining` does NOT exist.
  - `charms-sdk-15.0.0/src/lib.rs` — `main!` macro (proves arg order `(app, tx, x, w)`) and
    `app_version!` macro.
- Generated a real proving payload with `charms spell prove --payload --mock` using the template's
  `mint-nft.yaml` + `mint-nft-private.yaml`. Inspected the emitted JSON: `app_private_inputs` is a
  top-level field keyed by the full `"n/<id>/<vk>"` app string, value = hex-CBOR text string.
  Decoded both the spell hex (3 keys: `version`, `tx`, `app_public_inputs`) and the witness value
  (CBOR text string = the UTXO id).
- Cross-checked the v15 docs (`docs.charms.dev/reference/spell/`, `.../prover-api`,
  `.../how-to/write-an-app-contract`). They agree with the SDK source on field names and arg order.
  Where the docs' examples were sloppy (e.g. keying `app_private_inputs` by VK only, or mentioning
  a non-existent `nft_remaining`), the SDK source + generated payload were treated as authoritative.
- Compared against `packages/bitcoin/contracts/genesis-babies/src/lib.rs` at both `90cee8b` (real
  contract) and `HEAD` (debug stub), and against the worker
  `apps/workers/src/services/nft-minting-simple.ts`.
