---
paths:
  - "packages/bitcoin/**/*"
---

# Blockchain Security

## Claves Privadas
Las claves privadas expuestas permiten robo irreversible de fondos. Por eso:
- Nunca logear: `console.log(privateKey)` expone en DevTools
- Nunca hardcodear: el codigo es publico en git
- Limpiar memoria: `privateKey.fill(0)` despues de usar

## Transacciones
Validar antes de firmar porque las transacciones son irreversibles:
```typescript
if (!isValidAddress(to)) throw new Error('Invalid address');
if (amount <= 0) throw new Error('Invalid amount');
if (balance < amount + fee) throw new Error('Insufficient funds');
```

## Network
- `bitcoin.networks.testnet` en desarrollo
- Verificar network antes de broadcast

## Scrolls API
```typescript
const balance = await fetch(`${SCROLLS_API}/api/v1/balances/${address}`);
```
