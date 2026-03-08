---
name: charms-research
description: Investiga el protocolo Charms para tokens sobre Bitcoin. Usa cuando se pregunte sobre Spells, Runes, BitcoinOS, BitSNARK, Scrolls API, minting de tokens, o se trabaje en packages/bitcoin/src/charms/. Esencial para entender como BABY tokens funcionan.
allowed-tools: Read, Grep, Glob, WebFetch, WebSearch
---

# Charms Protocol Research

## Referencias
- Charms: https://charms.dev/
- BitcoinOS: https://www.bitcoinos.build/
- Docs: https://docs.charms.dev/

## Conceptos Clave

| Concepto | Descripcion |
|----------|-------------|
| **Spells** | Scripts YAML que definen operaciones de tokens |
| **Runes** | Standard de tokens usando OP_RETURN |
| **BitSNARK** | Verificacion ZK off-chain |
| **Scrolls** | Indexer API para balances/transacciones |
| **Grail Bridge** | Bridge 1-of-N para assets |

## Spell Ejemplo
```yaml
name: mine-baby
operations:
  - type: mint
    token: BABY
    amount: calculated_from_work
    recipient: miner_address
```

## Scrolls API
```
GET /api/v1/balances/{address}
GET /api/v1/tokens/{rune_id}
```
