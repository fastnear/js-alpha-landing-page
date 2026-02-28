# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A minimal static HTML demo of the `@fastnear/api` and `@fastnear/wallet` packages, using Berry Club — a collaborative pixel art board on the NEAR blockchain (`berryclub.ek.near`).

Serves as the primary test fixture for the `@fastnear/wallet` multi-wallet connector's session persistence, sign-in, and transaction flows.

## Running

```bash
cd /Users/mikepurvis/near/js-example-berryclub
python3 -m http.server
# Open http://localhost:8000/public/index.html
```

No package.json, no bundler, no npm dependencies. All `@fastnear/*` packages load via `<script>` tags from unpkg CDN.

## Project Structure

```
public/
  index.html              # Entry point — loads UMD globals + ES module
  index.js                # App logic: wireUpAppEarly() + wireUpAppLate()
  style.css               # Tachyons + custom dark theme
  manifest.json           # Wallet manifest — wallet list, executors, permissions
  assets/                 # Images and icons
mike/                     # Archived earlier version of the demo
```

## How It Works

### JS Loading Order

1. `@fastnear/api` UMD from unpkg → creates `window.near`
2. `@fastnear/wallet` UMD from unpkg → creates `window.nearWallet`
3. `<script type="module">` imports `./index.js`, calls `wireUpAppEarly()` immediately, then `wireUpAppLate()` on DOMContentLoaded

### Key Functions (index.js)

- **`wireUpAppEarly()`** — Configures `near` API and calls `nearWallet.restore()` to re-hydrate any previous wallet session. Both `restore()` and `connect()` pass `contractId` and `walletConnect` config so redirect wallets (MyNEARWallet) add/find FunctionCall access keys.
- **`wireUpAppLate()`** — Sets up DOM event handlers (Sign In, Sign Out, Buy Tokens, Draw Pixel), registers `nearWallet.onConnect`/`onDisconnect` listeners, and calls `updateUI()`.

### Session Persistence

`nearWallet.restore()` is non-blocking (fire-and-forget). The UI initially renders as signed-out. When `restore()` completes successfully, it fires `onConnect` listeners, which triggers `updateUI()` to re-render with the account name.

### Contract Interactions

- **View calls** (no auth): `near.view({ contractId, methodName, args })` — reads board lines, token balances
- **Transactions** (auth required): `nearWallet.sendTransaction({ receiverId, actions })` — draw pixels, buy tokens

### Wallet Manifest (`manifest.json`)

Local manifest listing 8 wallets: MyNearWallet, HOT Wallet, Intear Wallet, Meteor Wallet, OKX Wallet, NEAR Mobile, Nightly Wallet, and Wallet Connect. Each entry specifies an `executor` URL (JS loaded into a sandboxed `about:srcdoc` iframe by near-connect) and `permissions`.

Executor URLs point to `https://raw.githubusercontent.com/fastnear/near-connect/refs/heads/main/repository/<wallet>.js` — they track the `main` branch and update automatically when the built files are pushed.

### WalletConnect

WalletConnect requires a `projectId` from [cloud.reown.com](https://cloud.reown.com). The projectId (`4b2c7201ce4c03e0fb59895a2c251110`) is passed via `walletConnect: { projectId }` in both `restore()` and `connect()` calls. Wallets with `permissions.walletConnect: true` in the manifest are filtered out by near-connect when no projectId is configured.

The `walletConnect` option flows: `nearWallet.connect()` → `@fastnear/wallet` `getOrCreateConnector()` → `NearConnector` constructor → `window.selector.walletConnect` in the sandboxed iframe.

### FunctionCall Access Keys

When signing in via MyNearWallet with a `contractId`, the MNW executor generates a random key pair, stores the private key as `functionCallKey` in the sandboxed iframe's localStorage, and sends the public key to MNW for an on-chain AddKey transaction. On subsequent zero-deposit function calls, `signAndSendTransaction()` tries signing locally with this key before falling back to the wallet popup. This enables zero-popup transactions for methods like `draw` and `buy_tokens`.

### RPC Endpoints

The canonical RPC endpoints are:
- **Mainnet:** `https://rpc.mainnet.fastnear.com`
- **Testnet:** `https://rpc.testnet.fastnear.com`

These are configured in the near-connect MNW executor (`near-wallets/src/mnw.ts` and `near-wallets/src/utils/rpc.ts`). Using multiple out-of-sync RPC providers causes "Transaction parent block hash doesn't belong to the current chain" errors — always use a single consistent endpoint.

## Dependencies

- **`@fastnear/api`** (`^0.9.12`) — NEAR blockchain API, loaded as UMD global (`window.near`)
- **`@fastnear/wallet`** (`^0.9.12`) — Multi-wallet connector, loaded as UMD global (`window.nearWallet`); wraps `@fastnear/near-connect` (`^0.10.4`)

Loaded via bare unpkg URLs (no pinned version), e.g. `https://unpkg.com/@fastnear/wallet/dist/umd/browser.global.js`. These resolve to `latest` on npm. To cache-bust after publishing, hard-refresh the page (`Cmd+Shift+R`) and verify the version at `https://unpkg.com/@fastnear/wallet/package.json`.

## Related Repositories

- **fastnear-js-monorepo** (`/Users/mikepurvis/near/fastnear-js-monorepo`) — Source of `@fastnear/api`, `@fastnear/wallet` packages. Key file: `packages/wallet/src/connector.ts` (`getOrCreateConnector()` wires options including `walletConnect` through to `NearConnector`).
- **near-connect** (`/Users/mikepurvis/near/fn/near-connect`) — Source of `@fastnear/near-connect`. Contains wallet executors (`near-wallets/src/`), the `NearConnector` class (`src/NearConnector.ts`), popup UI (`src/popups/`), and built executor bundles (`repository/*.js`). After modifying executor source, rebuild with `cd near-wallets && yarn build:mnw` (or `build:wallets` for all), then push `repository/` to `main`.

## Debugging Tips

- Wallet executors run inside sandboxed `about:srcdoc` iframes — their localStorage is isolated from the parent page. Use DevTools → Application → Frames to inspect.
- `near-connect` popup height is controlled in `src/popups/styles.ts` (`max-height` on `.modal-content`) and `src/popups/IframeWalletPopup.ts` (iframe `height`).
- unpkg CDN caches aggressively; `raw.githubusercontent.com` caches ~5 minutes. Both can cause stale code after publishing.
