/** @type { import("@fastnear/api") } */
/* global near, nearWallet */
/* ^ UMD globals loaded via <script> tags in index.html */

// Constants
const contractId = "berryclub.ek.near";
const defaultNetwork = "mainnet";
const BoardHeight = 50;
const DefaultBalance = "0.0000 🥑";
const walletManifest = "/manifest.json";

// Resolves when restore() has settled (connected or not)
let restoreReady = Promise.resolve();

export function wireUpAppEarly(configOpts) {
  // configure near here (for the first and only time in this demo)
  const defaultConfig = { networkId: defaultNetwork };
  const updatedConfig = { ...defaultConfig, ...configOpts };
  near.config(updatedConfig);

  // Restore previous wallet session — store the promise so updateUI can wait
  restoreReady = nearWallet.restore({ network: defaultNetwork, contractId, manifest: walletManifest, walletConnect: { projectId: "4b2c7201ce4c03e0fb59895a2c251110" } }).then((result) => {
    if (result) {
      console.log("Restored wallet session:", result.accountId);
    }
  }).catch((err) => {
    console.warn("Wallet restore failed:", err);
  });
}

/**
 * wireUpAppLate is called after DOM is loaded.
 * We place all updateUI logic here, so it can actually be called on page load.
 */
export function wireUpAppLate() {
  // For decoding lines on the BerryClub board
  function intToColor(c) {
    return `#${c.toString(16).padStart(6, "0")}`;
  }

  function decodeLine(line) {
    const binary = atob(line);
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      buf[i] = binary.charCodeAt(i);
    }
    const pixels = [];
    for (let i = 4; i < buf.length; i += 8) {
      const color =
        buf[i] |
        (buf[i + 1] << 8) |
        (buf[i + 2] << 16) |
        (buf[i + 3] << 24);
      pixels.push(
        `<div class="pixel" style="background-color:${intToColor(color)}"></div>`
      );
    }
    return pixels.join("");
  }

  async function updateUI() {
    const authSection = document.getElementById("auth");

    // Wait for restore() to settle before rendering auth,
    // so we don't flash "Sign In" then switch to the account name
    await restoreReady;

    if (authSection && nearWallet.isConnected()) {
      authSection.classList.remove('open');

      authSection.innerHTML = `
        <div class="auth-pill">
          <span class="auth-account-name">${nearWallet.accountId()}</span>
        </div>
        <div class="auth-dropdown">
          <button id="sign-out" class="signout-button">Sign Out</button>
        </div>
      `;

      authSection.querySelector(".auth-pill").addEventListener("click", (e) => {
        e.stopPropagation();
        authSection.classList.toggle('open');
      });

      document.getElementById("sign-out")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        await nearWallet.disconnect();
        location.reload();
      });
    } else if (authSection) {
      authSection.classList.remove('open');

      authSection.innerHTML = `
        <button id="sign-in" class="auth-pill auth-signin">
          Sign In
        </button>
      `;

      document.getElementById("sign-in")?.addEventListener("click", async () => {
        await nearWallet.connect({ network: defaultNetwork, contractId, manifest: walletManifest, walletConnect: { projectId: "4b2c7201ce4c03e0fb59895a2c251110" } });
        updateUI();
      });
    }

    // Show total supply, personal balance, and the pixel board
    const totalSupplyElement = document.getElementById("total-supply");
    const yourBalanceElement = document.getElementById("your-balance");
    const board = document.getElementById("near-el-board");

    const [supplyResult, accountResult, linesResult] = await Promise.allSettled([
      near.view({ contractId, methodName: "ft_total_supply", args: {} }),
      nearWallet.accountId()
        ? near.view({ contractId, methodName: "get_account", args: { account_id: nearWallet.accountId() } })
        : Promise.resolve(null),
      near.view({ contractId, methodName: "get_lines", args: { lines: [...Array(BoardHeight).keys()] } }),
    ]);

    if (totalSupplyElement) {
      if (supplyResult.status === "fulfilled" && supplyResult.value) {
        totalSupplyElement.textContent = `${(parseFloat(supplyResult.value) / 1e18).toFixed(4)} 🥑`;
      } else {
        totalSupplyElement.textContent = "-";
        if (supplyResult.status === "rejected") console.error("Failed to fetch total supply:", supplyResult.reason);
      }
    }

    if (yourBalanceElement) {
      const berryAccount = accountResult.status === "fulfilled" ? accountResult.value : null;
      if (accountResult.status === "rejected") console.error("Failed to fetch account:", accountResult.reason);
      yourBalanceElement.textContent =
        berryAccount && !isNaN(berryAccount.avocado_balance)
          ? `${(parseFloat(berryAccount.avocado_balance) / 1e18).toFixed(4)} 🥑`
          : DefaultBalance;
    }

    if (board) {
      if (linesResult.status === "fulfilled") {
        board.innerHTML = linesResult.value
          .map((line) => `<div class="flex justify-center">${decodeLine(line)}</div>`)
          .join("");
      } else {
        console.error("Failed to fetch board lines:", linesResult.reason);
      }
    }
  }

  // Set up event handlers for buttons
  function setBtnSending(btn, sending) {
    if (sending) {
      btn._savedHTML = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = 'Sending\u2026<br><span class="btn-hint">check dev console for results</span>';
    } else {
      btn.disabled = false;
      btn.innerHTML = btn._savedHTML;
    }
  }

  function setupEventHandlers() {
    // Hook up the "Buy 25 🥑" button
    const buyBtn = document.getElementById("buy-tokens");
    buyBtn?.addEventListener("click", async () => {
      if (!nearWallet.isConnected()) {
        console.warn("Not signed in");
        return;
      }
      setBtnSending(buyBtn, true);
      try {
        const cu = near.utils.convertUnit;
        const result = await nearWallet.sendTransaction({
          signerId: nearWallet.accountId(),
          receiverId: contractId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "buy_tokens",
                gas: cu("100 Tgas"),
                deposit: cu("0.1 NEAR"),
                args: {},
              },
            },
          ],
        });
        console.log("buy_tokens result:", result);
        updateUI();
      } catch (err) {
        if (/reject|cancel/i.test(err.message)) {
          console.log("buy_tokens cancelled by user");
        } else {
          console.error("Failed to buy tokens:", err);
        }
      } finally {
        setBtnSending(buyBtn, false);
      }
    });

    // Hook up the "Draw Green Pixel" button
    const drawBtn = document.getElementById("draw-pixel");
    drawBtn?.addEventListener("click", async () => {
      if (!nearWallet.isConnected()) {
        console.warn("Not signed in");
        return;
      }
      setBtnSending(drawBtn, true);
      try {
        const cu = near.utils.convertUnit;
        const randVal = Math.floor(Math.random() * BoardHeight * BoardHeight);
        const result = await nearWallet.sendTransaction({
          signerId: nearWallet.accountId(),
          receiverId: contractId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "draw",
                gas: cu("100 Tgas"),
                deposit: "0",
                args: {
                  pixels: [
                    {
                      x: randVal % BoardHeight,
                      y: Math.floor(randVal / BoardHeight) % BoardHeight,
                      color: 65280, // green
                    },
                  ],
                },
              },
            },
          ],
        });
        console.log("draw result:", result);
        updateUI();
      } catch (err) {
        if (/reject|cancel/i.test(err.message)) {
          console.log("draw cancelled by user");
        } else {
          console.error("Failed to draw pixel:", err);
        }
      } finally {
        setBtnSending(drawBtn, false);
      }
    });
  }

  // Listen for wallet connect/disconnect events to refresh UI
  nearWallet.onConnect((result) => {
    console.log("Wallet connected:", result.accountId);
    updateUI();
  });

  nearWallet.onDisconnect(() => {
    console.log("Wallet disconnected");
    updateUI();
  });

  // Re-render when near API reports account changes (also fires on init)
  near.event.onAccount((accountId) => {
    if (accountId) console.log("fastnear: account update:", accountId);
    updateUI();
  });

  // Close auth dropdown when clicking outside
  document.addEventListener("click", (e) => {
    const authSection = document.getElementById("auth");
    if (authSection && !authSection.contains(e.target)) {
      authSection.classList.remove('open');
    }
  });

  // Initialize everything
  setupEventHandlers();
  updateUI();
}
