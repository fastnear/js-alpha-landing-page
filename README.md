# BerryClub: Static HTML → NEAR Blockchain

No bundler. No `node_modules`. No framework. Two `<script>` tags and a plain `.js` file — that's the entire build system for a fully functional NEAR dApp.

This is a working demo of [Berry Club](https://berryclub.io) (a collaborative pixel art board on NEAR) built with [`@fastnear/api`](https://www.npmjs.com/package/@fastnear/api) and [`@fastnear/wallet`](https://www.npmjs.com/package/@fastnear/wallet).

## Why This Matters

Every NEAR tutorial starts with `npx create-near-app`, which scaffolds a React project with 200MB of dependencies before you've written a line of contract interaction code. The actual blockchain API surface is tiny — a view call, a transaction, a wallet connection — but the tooling buries it under layers of abstraction.

This demo proves the point: **a static HTML file can do everything a bundled SPA can**.

| | Typical NEAR dApp | This demo |
|---|---|---|
| Dependencies | 500+ packages | 0 |
| Build step | webpack/vite/next | `python3 -m http.server` |
| Time to first view call | minutes (install, configure, build) | seconds (open HTML) |
| Deploy target | Node.js hosting, Vercel, etc. | Any static file server, CDN, IPFS |
| Bundle size shipped | 200KB–2MB gzipped | two 30KB UMD scripts from unpkg |

The libraries load as UMD globals from a CDN. Your app code is a plain ES module. There is nothing to compile, nothing to tree-shake, nothing to configure.

## How It Works

### Loading

```html
<!-- Creates window.near -->
<script src="https://unpkg.com/@fastnear/api/dist/umd/browser.global.js"></script>
<!-- Creates window.nearWallet -->
<script src="https://unpkg.com/@fastnear/wallet/dist/umd/browser.global.js"></script>

<script type="module">
  import { wireUpAppEarly, wireUpAppLate } from "./index.js";
  wireUpAppEarly();
  document.addEventListener("DOMContentLoaded", () => wireUpAppLate());
</script>
```

That's the entire bootstrap. `near` and `nearWallet` are available globally and in your module.

### View Calls (no auth)

Read any contract state without a wallet connection:

```js
const lines = await near.view({
  contractId: "berryclub.ek.near",
  methodName: "get_lines",
  args: { lines: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
});
```

### Wallet Connection

Multi-wallet support via a JSON manifest. Sign in, sign out, session restore across page loads:

```js
// Restore previous session (fire-and-forget, triggers onConnect if valid)
nearWallet.restore({ network: "mainnet", contractId, manifest: "/manifest.json" });

// Connect (opens wallet selector)
await nearWallet.connect({ network: "mainnet", contractId, manifest: "/manifest.json" });

// Listen for events
nearWallet.onConnect((result) => console.log("Connected:", result.accountId));
nearWallet.onDisconnect(() => console.log("Disconnected"));
```

### Transactions (auth required)

```js
await nearWallet.sendTransaction({
  signerId: nearWallet.accountId(),
  receiverId: "berryclub.ek.near",
  actions: [{
    type: "FunctionCall",
    params: {
      methodName: "draw",
      args: { pixels: [{ x: 10, y: 20, color: 65280 }] },
      gas: $$`100 Tgas`,
      deposit: "0",
    },
  }],
});
```

The `$$` template literal is a unit conversion helper from `@fastnear/api` — `$$`100 Tgas`` becomes the yocto string, `$$`0.1 NEAR`` becomes `"100000000000000000000000"`.

## Running

```bash
python3 -m http.server
# Open http://localhost:8000/public/index.html
```

That's it. If you want to develop against local builds of `@fastnear/api` or `@fastnear/wallet`, symlink their `dist/` directories into `public/` and update the `<script>` `src` attributes.

## Project Structure

```
public/
  index.html          # Entry point — two UMD scripts + one ES module import
  index.js            # wireUpAppEarly() + wireUpAppLate() — all app logic
  style.css           # Tachyons utility classes + custom dark theme
  manifest.json       # Wallet manifest (which wallets to offer)
  assets/             # Favicon, images
mike/                 # Archived earlier version of the demo
```

## Links

- [`@fastnear/api` on npm](https://www.npmjs.com/package/@fastnear/api)
- [`@fastnear/wallet` on npm](https://www.npmjs.com/package/@fastnear/wallet)
- [fastnear/js-monorepo on GitHub](https://github.com/fastnear/js-monorepo)
- [Berry Club](https://berryclub.io)
