import OBR from "@owlbear-rodeo/sdk";

// Local state
let items = [];
let currentTurnIndex = 0;
let currentRound = 1;
let isGM = false;

// DOM Elements
const app = document.getElementById("app");
const tabBtns = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");
const initiativeList = document.getElementById("initiative-list");

// --- Initialization ---
OBR.onReady(async () => {
  const role = await OBR.player.getRole();
  isGM = role === "GM";

  if (!isGM) {
    // Lock overflow and apply player layout overrides
    document.body.classList.add("player-mode");
    app.classList.add("player-view");
  } else {
    document.body.classList.remove("player-mode");
    app.classList.remove("player-view");
  }

  setupEventListeners();
  render();
  adjustWindowHeight();
});

// --- Dynamic Window Resizing ---
function adjustWindowHeight() {
  if (OBR.isReady) {
    const height = document.body.scrollHeight;
    // DM gets normal limits; Player stays tightly framed
    const maxHeight = isGM ? 650 : 350;
    OBR.popover.setHeight("manual-initiative-tracker", Math.min(height, maxHeight));
  }
}

// --- Event Listeners ---
function setupEventListeners() {
  // Tab Switching
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.dataset.tab;

      tabBtns.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(`${targetTab}-tab`).classList.add("active");

      adjustWindowHeight();
    });
  });

  // GM Controls
  if (isGM) {
    document.getElementById("add-combatant-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const nameInput = document.getElementById("combatant-name");
      const initInput = document.getElementById("combatant-init");
      const hpInput = document.getElementById("combatant-hp");

      if (!nameInput.value) return;

      items.push({
        id: crypto.randomUUID(),
        name: nameInput.value,
        initiative: parseInt(initInput.value, 10) || 0,
        hp: parseInt(hpInput.value, 10) || 0,
      });

      sortInitiative();
      nameInput.value = "";
      initInput.value = "";
      hpInput.value = "";
      render();
    });

    document.getElementById("next-turn-btn")?.addEventListener("click", () => {
      if (items.length === 0) return;
      currentTurnIndex++;
      if (currentTurnIndex >= items.length) {
        currentTurnIndex = 0;
        currentRound++;
      }
      render();
    });

    document.getElementById("prev-turn-btn")?.addEventListener("click", () => {
      if (items.length === 0) return;
      currentTurnIndex--;
      if (currentTurnIndex < 0) {
        currentTurnIndex = items.length - 1;
        if (currentRound > 1) currentRound--;
      }
      render();
    });

    document.getElementById("reset-combat-btn")?.addEventListener("click", () => {
      items = [];
      currentTurnIndex = 0;
      currentRound = 1;
      render();
    });
  }
}

// --- Logic Helpers ---
function sortInitiative() {
  items.sort((a, b) => b.initiative - a.initiative);
}

// --- UI Rendering ---
function render() {
  // Update Round Tracker Counter
  const roundEl = document.getElementById("round-count");
  if (roundEl) roundEl.textContent = currentRound;

  // Render Combat List
  if (!initiativeList) return;
  initiativeList.innerHTML = "";

  if (items.length === 0) {
    initiativeList.innerHTML = `<div style="color: var(--muted); text-align: center; padding: 12px;">No combatants added.</div>`;
    adjustWindowHeight();
    return;
  }

  items.forEach((item, index) => {
    const isCurrentTurn = index === currentTurnIndex;
    const card = document.createElement("div");
    card.className = `card ${isCurrentTurn ? "turn-active" : ""}`;

    let controlsHTML = "";
    if (isGM) {
      controlsHTML = `
        <button class="btn btn-secondary btn-sm remove-btn" data-id="${item.id}">✕</button>
      `;
    }

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <strong style="font-size: 14px;">${item.initiative}</strong>
          <span style="font-weight: 500;">${item.name}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${item.hp !== undefined && item.hp !== null ? `<span style="color: var(--muted); font-size: 11px;">HP: ${item.hp}</span>` : ""}
          ${controlsHTML}
        </div>
      </div>
    `;

    initiativeList.appendChild(card);
  });

  // Attach GM Delete Listeners
  if (isGM) {
    document.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.id;
        items = items.filter((i) => i.id !== id);
        if (currentTurnIndex >= items.length && items.length > 0) {
          currentTurnIndex = items.length - 1;
        }
        render();
      });
    });
  }

  adjustWindowHeight();
}
