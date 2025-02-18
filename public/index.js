/** @type { import("https://unpkg.com/@fastnear/api@0.7.2/dist/esm/index.d.ts") } */
/* global near */
/* ^ this stuff aids in IDE hints */

// contract info
const contractId = "berryclub.ek.near";
const defaultNetwork = "mainnet";

export const fastNearJs = (configOpts) => {
  const defaultConfig = { networkId: defaultNetwork };
  const updatedConfig = { ...defaultConfig, ...configOpts };
  near.config(updatedConfig);

  let transactions = [];

  function addPendingTx(hash) {
    transactions.unshift({ hash, status: "pending" });
    transactions = transactions.slice(0, 5);
    updateUI();
  }

  function updateTx(hash, status) {
    const tx = transactions.find((t) => t.hash === hash);
    if (tx) {
      tx.status = status;
    } else {
      transactions.unshift({ hash, status });
    }
  }

  // register for transaction updates
  near.onTx((txStatus) => {
    console.log("tx status update", txStatus);
    const hash = txStatus?.transaction?.hash;
    let status = "Success";
    if (txStatus.status && txStatus.status.Failure) {
      status = "Failure";
    }
    updateTx(hash, status);
    updateUI();
  });

  // register for account changes
  near.onAccount((accountId) => {
    console.log("account update:", accountId);
    updateUI();
  });

  const BoardHeight = 50;
  const DefaultBalance = 25;
  const cu = near.utils.convertUnit;
  const lines = [...Array(BoardHeight).keys()];

  // decode board lines
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

    // If signed in, show account + sign out
    if (authSection && near.accountId()) {
      authSection.innerHTML = `
        <div class="mb1">${near.accountId()}</div>
        <button
          id="sign-out"
          class="br2 ph3 pv1"
        >
          Sign Out
        </button>
      `;
      document
        .getElementById("sign-out")
        .addEventListener("click", () => {
          near.signOut();
          location.reload();
        });

      // If not signed in, show the contract ID input + Connect Wallet
    } else if (authSection) {
      authSection.innerHTML = `
        <div
          class="pa3 br2"
          style="background: rgba(0, 0, 0, 0.7); min-width: 220px; border: 1px solid rgba(255, 255, 255, 0.3);"
        >
          <div class="flex flex-column">
            <label class="f6 white-60 mb2">contract</label>
            <input
              type="text"
              id="contractId"
              value="${contractId}"
              class="input-reset ba b--white-30 pa2 mb2 w5 br2 bg-black-30 white"
              style="width:100%;"
            />
            <button
              id="sign-in"
              class="bn br2 pv2 ph3 pointer"
              style="background: var(--accent);"
            >create session key</button>
          </div>
        </div>
      `;
      // Hook up the Connect Wallet button
      document
        .getElementById("sign-in")
        .addEventListener("click", () => {
          const contractInput = document.getElementById("contractId");
          near.requestSignIn({
            contractId: contractInput?.value || contractId,
          });
        });
    }

    const totalSupplyElement = document.getElementById("total-supply");
    const yourBalanceElement = document.getElementById("your-balance");
    const board = document.getElementById("board");
    const txSection = document.getElementById("tx-section");

    try {
      const totalSupply = await near.view({
        contractId,
        methodName: "ft_total_supply",
        args: {},
      });

      const berryAccount = near.accountId()
        ? await near.view({
          contractId,
          methodName: "get_account",
          args: { account_id: near.accountId() },
        })
        : null;

      totalSupplyElement.textContent = totalSupply
        ? (parseFloat(totalSupply) / 1e18).toFixed(4)
        : "-";

      yourBalanceElement.textContent =
        berryAccount && !isNaN(berryAccount.avocado_balance)
          ? (parseFloat(berryAccount.avocado_balance) / 1e18).toFixed(4)
          : DefaultBalance;

      const encodedLines = await near.view({
        contractId,
        methodName: "get_lines",
        args: { lines },
      });

      board.innerHTML = encodedLines
        .map(
          (line) =>
            `<div class="flex justify-center">${decodeLine(line)}</div>`
        )
        .join("");
    } catch (err) {
      console.error("Error updating UI:", err);
    }

    // Transactions table
    if (!transactions.length) {
      txSection.innerHTML = `<p class="gray">No recent transactions</p>`;
    } else {
      const rows = transactions
        .map(({ hash, status }) => {
          let colorClass = "gray";
          if (status === "Success") colorClass = "green";
          else if (status === "Failure") colorClass = "red";
          return `
            <tr>
              <td class="pv2 ph3 bb b--black-20">
                <a 
                  class="underline hover-blue"
                  href="https://nearblocks.io/txns/${hash}"
                  target="_blank"
                >
                  ${hash}
                </a>
              </td>
              <td class="pv2 ph3 bb b--black-20 ${colorClass}">
                ${status}
              </td>
            </tr>
          `;
        })
        .join("");
      txSection.innerHTML = `
        <table class="w-100 tl collapse">
          <thead>
            <tr>
              <th class="pv2 ph3 bb b--black-20">Tx Hash</th>
              <th class="pv2 ph3 bb b--black-20">Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }
  }

  // snippet toggling
  window.toggleSnippet = function (snippetId, arrowId) {
    const snippet = document.getElementById(snippetId);
    const arrow = document.getElementById(arrowId);
    snippet.classList.toggle('hidden-snippet');
    arrow.classList.toggle('rotated');
    arrow.classList.toggle('gray');
  }

  // Buy tokens button
  document
    .getElementById("buy-tokens")
    .addEventListener("click", async () => {
      try {
        const res = await near.sendTx({
          receiverId: contractId,
          actions: [
            near.actions.functionCall({
              methodName: "buy_tokens",
              gas: cu("100 Tgas"),
              deposit: cu("0.1 NEAR"),
              args: {},
            }),
          ],
        });
        const hash = res?.transaction?.hash;
        if (hash) addPendingTx(hash);
      } catch (err) {
        console.error("Failed to buy tokens:", err);
      }
    });

  // Draw random green pixel
  document
    .getElementById("draw-pixel")
    .addEventListener("click", async () => {
      try {
        const randVal = Math.floor(Math.random() * BoardHeight * BoardHeight);
        const fnObj = {
          methodName: "draw",
          gas: cu("100 Tgas").toString(),
          deposit: "0",
          args: {
            pixels: [
              {
                x: randVal % BoardHeight,
                y: Math.floor(randVal / BoardHeight) % BoardHeight,
                color: 65280,
              },
            ],
          },
        };
        const res = await near.sendTx({
          receiverId: contractId,
          actions: [near.actions.functionCall(fnObj)],
        });
        const hash = res?.transaction?.hash;
        if (hash) addPendingTx(hash);
      } catch (err) {
        console.error("Failed to draw pixel:", err);
      }
    });

  // Clipboard setup
  const clipboard = new ClipboardJS(".copy-button");
  clipboard.on("success", (e) => {
    const btn = e.trigger;
    const originalText = btn.textContent;
    btn.textContent = "✅";
    setTimeout(() => {
      btn.textContent = originalText;
    }, 666);
    e.clearSelection();
  });

  // Initial UI
  updateUI();
};
