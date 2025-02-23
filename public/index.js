/** @type { import("../../../packages/api/dist/esm/index.d.ts") } */
/* global near */
/* ^ this stuff aids in IDE hints */

// Constants
const contractId = "berryclub.ek.near";
const defaultNetwork = "mainnet";
const BoardHeight = 50;
const DefaultBalance = "0.0000 🥑";

export function wireUpAppEarly(configOpts) {
  // configure near here (for the first and only time in this demo)
  const defaultConfig = { networkId: defaultNetwork };
  const updatedConfig = { ...defaultConfig, ...configOpts };
  near.config(updatedConfig);
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

  // Track recent transactions in memory
  let transactions = [];

  function addPendingTx(hash) {
    transactions.unshift({ hash, status: "pending" });
    transactions = transactions.slice(0, 5); // keep at most 5
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

  async function updateUI() {
    const authSection = document.getElementById("auth");

    if (authSection && near.authStatus() === "SignedIn") {
      const contract = near.selected().contract;
      const fullPublicKey = near.selected().publicKey;
      const [curveType, hexPayload] = fullPublicKey.split(":");
      const initialLetter = curveType ? curveType[0].toUpperCase() : "?";

      // start off collapsed
      authSection.classList.add('collapsed');

      authSection.innerHTML = `
        <div id="auth-logged-in" class="flex flex-column items-center w-100">
          <div class="account-name truncate w-100 tc white-90 stop-prop">
            ${near.accountId()}
          </div>
          <div class="expanded-content dn w-100">
            <div class="near-contract copyable pa1 ma2 lightest-blue tc pb0 mb1" data-copy="${contract}">
              ${contract}
            </div>
            <div class="near-public-key copyable pa1 ma2 pt0 lightest-blue tc flex items-center" data-copy="${near.publicKey()}">
              <div class="public-key-square-initial bg-light-green dark-gray w1 h1 flex items-center justify-center f5 fw6 mr2">
                ${initialLetter}
              </div>
              <div class="public-key-truncated white-80 truncate w-100 tc f7 code">
                ${hexPayload.slice(0, 8)}…${hexPayload.slice(-8)}
              </div>
            </div>
            <button id="sign-out" class="mt3 ba pointer signout-button">
              Sign Out
            </button>
          </div>
        </div>
      `;

      const expandedContent = authSection.querySelector(".expanded-content");
      const accountName = authSection.querySelector(".account-name");
      const nearContract = authSection.querySelector(".near-contract");
      const publicKey = authSection.querySelector(".near-public-key");

      document.addEventListener("click", async (event) => {
        const target = event.target.closest(".stop-prop");
        if (!target) return;

        event.stopPropagation();
      });

      document.addEventListener("click", async (event) => {
        const target = event.target.closest(".copyable");
        if (!target) return;

        try {
          await navigator.clipboard.writeText(target.getAttribute("data-copy"));
          event.stopPropagation();

          authSection.classList.add("copy-flash");
          setTimeout(() => authSection.classList.remove("copy-flash"), 123);
        } catch (err) {
          console.error("Failed to copy:", err);
        }
      });

      // Toggle expanded state if the user clicks the outer container
      authSection.addEventListener("click", (e) => {
        const clickedAuthContainer =
          e.target === authSection || e.target === authSection.firstElementChild;
        const clickedAccountName = e.target.classList.contains("account-name");
        const clickedContract = e.target.classList.contains("near-contract");
        const clickedPublicKey = e.target.classList.contains("public-key-square-initial") ||
          e.target.classList.contains("public-key-truncated");

        // Only toggle when clicking the container or account name
        if (clickedAuthContainer || clickedAccountName) {
          expandedContent.classList.toggle("dn");
          accountName.classList.add("pointer");
          nearContract.classList.add("pointer");
          publicKey.classList.add("pointer");

          authSection.classList.toggle('expanded');
          authSection.classList.toggle('collapsed');
        }

        if (clickedContract) {
          e.target.classList.add("copy-outline");
          setTimeout(() => e.target.classList.remove("copy-outline"), 321);
        }

        // this one is tricky since we want the outline on the container
        if (clickedPublicKey) {
          publicKey.classList.add("copy-outline");
          setTimeout(() => publicKey.classList.remove("copy-outline"), 321);
        }
      });

      // sign out just deletes keys for now, which is not great
      // in the future we'll get rid of them from the account
      // work that in
      document.getElementById("sign-out")?.addEventListener("click", (e) => {
        e.stopPropagation();
        near.signOut();
        location.reload();
      });
    } else if (authSection) {
      // user is not signed in

      // start off expanded
      authSection.classList.add('expanded');

      authSection.innerHTML = `
        <div id="auth-logged-out" class="pa1" style="min-width: 220px">
          <div class="flex flex-column">
            <label class="f5 white-80 mb3">near contract:</label>
            <input
              type="text"
              id="contractId"
              value="${contractId}"
              class="input-reset ba b--white-30 pa2 mb2 w5 br2 bg-black-30 white"
            />
            <button
              id="sign-in"
              class="bn br2 pv2 ph3 pointer mt2"
              style="background: var(--accent);"
            >
              create session key
            </button>
          </div>
        </div>
      `;

      document.getElementById("sign-in")?.addEventListener("click", () => {
        const contractInput = document.getElementById("contractId");
        near.requestSignIn({
          contractId: contractInput?.value || contractId,
        });
      });
    }

    // Show total supply, personal balance, and the pixel board
    const totalSupplyElement = document.getElementById("total-supply");
    const yourBalanceElement = document.getElementById("your-balance");
    const board = document.getElementById("near-el-board");

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

      if (totalSupplyElement) {
        totalSupplyElement.textContent = totalSupply
          ? `${(parseFloat(totalSupply) / 1e18).toFixed(4)} 🥑`
          : "-";
      }

      if (yourBalanceElement) {
        yourBalanceElement.textContent =
          berryAccount && !isNaN(berryAccount.avocado_balance)
            ? `${(parseFloat(berryAccount.avocado_balance) / 1e18).toFixed(4)} 🥑`
            : DefaultBalance;
      }

      if (board) {
        const encodedLines = await near.view({
          contractId,
          methodName: "get_lines",
          args: { lines: [...Array(BoardHeight).keys()] },
        });
        board.innerHTML = encodedLines
          .map(
            (line) => `<div class="flex justify-center">${decodeLine(line)}</div>`
          )
          .join("");
      }
    } catch (err) {
      console.error("Error updating UI:", err);
    }
  }

  // Set up event handlers for buttons
  function setupEventHandlers() {
    // Hook up the "Buy 25 🥑" button
    document.getElementById("buy-tokens")?.addEventListener("click", async () => {
      try {
        const cu = near.utils.convertUnit;
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

    // Hook up the "Draw Green Pixel" button
    document.getElementById("draw-pixel")?.addEventListener("click", async () => {
      try {
        const cu = near.utils.convertUnit;
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
                color: 65280, // green
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
  }

  const txMap = new Map();

  near.event.onTx((txStatus) => {
    const chainStatus = txStatus?.status ?? "unknown";
    const txHash = txStatus?.txHash || "unknown hash";
    const txHashTruncated = `${txHash.slice(0, 6)}…${txHash.slice(-6)}`;
    const txResult = txStatus?.result?.result || {};
    const txUpdateTimestamp = txStatus?.updateTimestamp || 'unknown timestamp';
    // this is supplied by the protocol, which is nice
    const isFinalState = txStatus.finalState;

    const hash = txStatus?.transaction?.hash || txHash;

    let finalStatus
    if (isFinalState && txStatus.status.Failure) {
      finalStatus = "Failure";
    } else {
      finalStatus = "Success";
    }

    // get current status updates for tx by hash
    const currentTxProgress = txMap.get(hash) || {
      contract: txStatus?.tx?.receiverId || '',
      hash: txHash,
      result: txResult,
      status: [],
    }
    const currentTxStatusUpdates = currentTxProgress.status || []

    // status is an array, push to it
    currentTxStatusUpdates.push({
      value: chainStatus,
      timestamp: txUpdateTimestamp,
    })

    // Keep a record of the latest data for this tx
    txMap.set(hash, {
      contract: txStatus?.tx?.receiverId || '',
      hash: txHash,
      status: currentTxStatusUpdates,
    });

    if (!isFinalState) {
      console.log(`Tx in progress: ${hash} => ${chainStatus}`);
    }

    const txDetails = txMap.get(hash)

    // log details for devs
    if (isFinalState) {
      console.group(`Transaction summary — ${txDetails.contract}\t(${near.config().networkId}) — ${txDetails.hash}`);

      const txTableData = Object.fromEntries(
        txDetails.status.reverse().map((statusUpdate) => {
          let readableDate = '';
          try {
            readableDate = new Date(statusUpdate.timestamp).toLocaleTimeString();
            readableDate = `${readableDate} (${statusUpdate.timestamp})`;
          } catch (e) {
            console.error('Error converting timestamp to readable date', e, statusUpdate);
          }
          return [readableDate, { 'transaction status': statusUpdate.value }];
        })
      );

      console.table(txTableData);
      console.info('Block explorer:', `https://nearblocks.io/txns/${txDetails.hash}`);
      console.groupEnd();
    }

    // update, but NEVER BLOCK THE UI ~ The Dream
    updateTx(hash, finalStatus);
    updateUI();
  });

  near.event.onAccount(accountId => {
    if (accountId) console.log("fastnear: account update:", accountId);
    updateUI();
  });

  // Initialize everything
  setupEventHandlers();
  updateUI();
}
