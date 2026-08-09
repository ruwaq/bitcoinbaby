# VK Reconciliation Audit — babtc contract

> **Fecha:** 2026-08-09
> **Problema:** 3-4 VKs divergentes circulando para el MISMO contrato babtc v1.
> **Riesgo:** supply-chain (el binario embebido en workers no se buildea desde source en CI) + inconsistencia docs/runtime.

## VKs encontrados

| VK (hex)                                                           | Origen                                | file:line                                                                                        | Notas                                                                                                                                                                                                           |
| ------------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ab70796e62562b5245cf746d7ecf4b95b86df582921ae42ec2ceea25612807c6` | **CANÓNICO (on-chain + cargo build)** | `packages/bitcoin/contracts/babtc/src/lib.rs` → `cargo build --release --target wasm32-wasip1`   | VK real del source actual. Coincide con el contrato desplegado en testnet4 (genesis `b3deba07...:0`, block ~75000). Es el VK del wasm crudo de cargo (`babtc_contract.wasm`, 88233 bytes).                      |
| `acf2ec0b7245eb9c3371ef4e67eb1ca3f85d712b1aeca438a6a6d1898392179d` | **charms app build** (wrapper)        | `packages/bitcoin/contracts/babtc/DEPLOYMENT.md:8`, `packages/bitcoin/src/config/testnet4.ts:92` | VK del wasm envuelto por `charms app build` (`babtc-contract.wasm`, 258708 bytes). El wrapper de charms cambia el hash. Usado por config/signer/deploy-collection pero **NO coincide** con el binario on-chain. |
| `72cddbf02e3412f92ed134fd88dffdfa918c74faf5695db118ff6cb98fc602f0` | **STALE** en BUILD.md                 | `packages/bitcoin/contracts/babtc/BUILD.md:23`, `packages/bitcoin/contracts/babtc/BUILD.md:79`   | Documentación obsoleta (BUILD.md sin tocar desde `de56feb`, 2026-03-05). No coincide con NINGÚN artifact actual del source `lib.rs` (último cambio `662948e`, 2026-08-09).                                      |
| `ab70796e62562b5245cf746d7ecf4b95b86df582921ae42ec2ceea25612807c6` | binario embebido v1 en workers        | `apps/workers/src/lib/babtc-contract-binary.ts:10`                                               | **MATCH exacto** con el VK canónico cargo-built. El binario decodificado (88233 bytes wasm) tiene el mismo sha256 que el wasm crudo de cargo. El binario embedded ES el output de `cargo build`.                |

> **KEY FINDING:** El binario embebido en workers (`ab70796e...`) **SÍ coincide** con el wasm construido desde el source actual vía `cargo build`. NO hay tampering del binario — el riesgo es de proceso (no se regenera en CI), no de divergencia de bytes. La divergencia real es entre `cargo build` y `charms app build` (dos pipelines distintos del mismo source producen hashes distintos porque charms envuelve el wasm).

## Divergencia de pipelines (causa raíz)

El mismo `src/lib.rs` produce DOS wasm distintos según el comando:

| Comando                                        | Output                           | Tamaño       | SHA256 (VK)        |
| ---------------------------------------------- | -------------------------------- | ------------ | ------------------ |
| `cargo build --release --target wasm32-wasip1` | `target/.../babtc_contract.wasm` | 88233 bytes  | `ab70796e...807c6` |
| `charms app build`                             | `target/.../babtc-contract.wasm` | 258708 bytes | `acf2ec0b...2179d` |

`charms app build` invoca cargo internamente y luego **envuelve** el wasm con metadatos de spell (de ahí el growth 88KB → 258KB y el cambio de hash). Ambos `charms app vk` y `sha256sum` coinciden entre sí para cada archivo respectivo.

La on-chain (genesis UTXO `b3deba0743aeffd0e455ce442b1693107090341381e3d8bcc5f586667c3e8a81:0`) usa el VK `ab70796e...` (verificado en `docs/audits/DEPLOYMENT.md:23` y `packages/bitcoin/scripts/spell.yaml:3`). Por ende el **VK de verdad en producción es `ab70796e...`** (cargo output), y los consumidores que apuntan a `acf2ec0b...` están equivocados respecto al binario real que valida la chain.

## Consumidores por VK

| VK                                        | Consumidores                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ab70796e...` (canónico on-chain + cargo) | `apps/workers/wrangler.toml:86,146,205` · `apps/workers/src/lib/babtc-contract-binary.ts:10` · `apps/workers/src/services/batch-minting.ts:100` · `packages/bitcoin/scripts/spell.yaml:3` · `docs/audits/DEPLOYMENT.md:23` · `docs/TREASURY_SETUP.md:24,129` · `docs/audits/BUG_SCAN_LATEST.md:377`                                                                                                                                                     |
| `acf2ec0b...` (charms wrapper)            | `packages/bitcoin/src/config/testnet4.ts:92` · `packages/bitcoin/contracts/babtc/DEPLOYMENT.md:8,16,133` · `scripts/signer/mint-babtc.ts:42` · `scripts/mint-babtc-standalone.ts:32` · `scripts/deploy-collection.ts:39` · `scripts/mint-babtc-v11.ts:21` · `packages/bitcoin/scripts/test-spell.yaml:5` · `packages/bitcoin/scripts/test-private-inputs.yaml:2` · `packages/bitcoin/scripts/test-spell-v11.yaml:27` · `docs/CHARMS_PROVER_GUIDE.md:89` |
| `72cddbf0...` (stale)                     | `packages/bitcoin/contracts/babtc/BUILD.md:23,79` (única aparición en todo el repo)                                                                                                                                                                                                                                                                                                                                                                     |

## Tres binarios WASM embebidos como strings TS

| Archivo                                            | Tamaño TS    | Tamaño wasm (decoded) | VK declarado        | sha256(decoded)     | Match? | Contrato       | Riesgo                          |
| -------------------------------------------------- | ------------ | --------------------- | ------------------- | ------------------- | ------ | -------------- | ------------------------------- |
| `apps/workers/src/lib/babtc-contract-binary.ts`    | 118075 bytes | 88233 bytes           | `ab70796e...807c6`  | `ab70796e...807c6`  | YES    | babtc v1       | No buildeado desde source en CI |
| `apps/workers/src/lib/babtc-v2-contract-binary.ts` | 334075 bytes | 250242 bytes          | `bad3cb4e...7b67d`  | `bad3cb4e...7b67d`  | YES    | babtc v2       | No buildeado desde source en CI |
| `apps/workers/src/lib/nft-contract-binary.ts`      | 353012 bytes | 264108 bytes          | `0d9483a7...5b08ba` | `0d9483a7...5b08ba` | YES    | genesis-babies | No buildeado desde source en CI |

> En los tres archivos el VK declarado coincide con `sha256` del binario decodificado. Es decir, los `*_VK` embebidos son **internamente consistentes** con sus `*_BINARY` hermanos. El riesgo NO es de integridad por-archivo, sino de **proveniencia**: ninguno se regenera desde source en CI, así que un cambio a `lib.rs` puede (y ya lo hizo — ver `72cddbf0...` stale en BUILD.md) dejar los binarios desincronizados con el source sin que nadie lo note.

## Anomalías detectadas

1. **BUILD.md stale (alta severidad).** `BUILD.md:23,79` declara VK `72cddbf0...` que **no coincide con ningún artifact** construido hoy desde `src/lib.rs` (última edición `662948e` 2026-08-09, Sub-proyecto B). BUILD.md no se toca desde `de56feb` (2026-03-05). Cualquier dev que siga BUILD.md y copie el VK se equivocará.
2. **Divergencia cargo vs charms (alta severidad).** `cargo build` y `charms app build` sobre el mismo source producen wasm con distinto sha256 (`ab70796e...` vs `acf2ec0b...`). Workers/config/wrangler apuntan a VKs distintos para el MISMO appId (`87b5ecfb...`). El runtime de workers usa `ab70796e...` (que coincide con on-chain), pero el signer (`scripts/signer/mint-babtc.ts:42`) y `config/testnet4.ts:92` apuntan a `acf2ec0b...`. Esto significa que el SDK cliente y el backend de workers construyen appRefs distintos (`t/<appId>/<vk>`) para el mismo contrato.
3. **Match binario-cargo (positivo).** El binario embebido en `babtc-contract-binary.ts` es byte-idéntico (88233 bytes, mismo sha256) al wasm que produce `cargo build` hoy. NO hay divergencia entre el binario embebido y el source actual. El riesgo documentado en el spec ("no se buildea desde source en CI") se confirma como riesgo de proceso, no de divergencia actual.
4. **DEPLOYMENT.md vs docs/audits/DEPLOYMENT.md contradictorios.** `packages/bitcoin/contracts/babtc/DEPLOYMENT.md:8` dice `acf2ec0b...`; `docs/audits/DEPLOYMENT.md:23` dice `ab70796e...`. Dos docs "oficiales" de deployment del mismo contrato con distinto VK.

## Plan de resolución (Fase 0.3 + Fase 2)

1. **Fase 0.3:** Añadir job de CI que buildea los 3 contratos desde source y publica el VK + binario. El job debe decidir **explícitamente** cuál pipeline es canónico (`cargo build` directo, dado que es el que coincide con on-chain) y fallar si el VK generado no coincide con el declarado en wrangler/config.
2. **Fase 0.3 (acción inmediata):** Actualizar `BUILD.md:23,79` para que el VK documentado coincida con el artifact real (`ab70796e...`), o borrar el VK hardcodeado y reemplazarlo por instrucciones para correr `charms app vk`. Mientras tanto,marcar BUILD.md como STALE.
3. **Fase 2:** Tras reescribir `calculate_reward` en `lib.rs`, todos los consumidores (config, wrangler, signer, batch-minting, los tres `*-contract-binary.ts`, los `.yaml` de test) se re-apuntan al VK canónico del build de CI. Se elimina la ambigüedad cargo-vs-charms eligiendo uno solo como canónico.
4. **Reset testnet4 aceptable** (spec sección 2) — no hay migración de tokens. Tras el reset, el nuevo deployment define el VK canónico y todos los consumidores se alinean.

## Lección

Nunca embeber binarios WASM como strings hardcoded sin un job de CI que los regenere y verifique contra el source. El contrato fuente es la fuente de verdad; el binario se genera en CI y su VK se propaga automáticamente a config/wrangler/docs. Dos pipelines distintos (`cargo build` vs `charms app build`) sobre el mismo source pueden producir hashes distintos — hay que fijar uno solo como canónico y documentarlo.
