import OBR from "@owlbear-rodeo/sdk";

// Local state
let items = [];
let currentTurnIndex = 0;
let currentRound = 1;
let isGM = true; // Default to true so controls work even if OBR SDK delays

// Helper: Safely add event listeners without crashing if element is missing
function safeAddListener(id, event, handler) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener(event, handler);
  }
}

// Logic Helpers
function sortInitiative() {
  items.sort((a, b) => b.initiative - a.initiative);
}

// Dynamic Window Resizing
function adjustWindowHeight() {
  try {
    if (OBR.isReady) {
      const height = document.body.scrollHeight;
      const maxHeight = isGM ? 650 : 350;
      OBR.popover.setHeight("manual-initiative-tracker", Math.min(height, maxHeight));
    }
  } catch (e) {
    console.warn("OBR setHeight error:", e);
  }
}

// UI Rendering
function render() {
  const initiativeList = document.getElementById("initiative-list");
  const roundEl = document.getElementById("round-count");

  if (roundEl) roundEl.textContent = currentRound;

  if (initiativeList) {
    initiativeList.innerHTML = "";

    if (items.length === 0) {
      initiativeList.innerHTML = `<div style="color: var(--muted); text-align: center; padding: 12px;">No combatants added.</div>`;
    } else {
      items.forEach((item, index) => {
        const isCurrentTurn = index === currentTurnIndex;
        const card = document.createElement("div");
        card.className = `card ${isCurrentTurn ? "turn-active" : ""}`;

        const removeBtnHTML = isGM 
          ? `<button class="btn btn-secondary btn-sm remove-btn" data-id="${item.id}">✕</button>` 
          : "";

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <strong style="font-size: 14px;">${item.initiative}</strong>
              <span style="font-weight: 500;">${item.name}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              ${item.hp !== undefined && item.hp !== null && item.hp !== "" ? `<span style="color: var(--muted); font-size: 11px;">HP: ${item.hp}</span>` : ""}
              ${removeBtnHTML}
            </div>
          </div>
        `;

        initiativeList.appendChild(card);
      });
    }
  }

  // Attach GM Delete Button Listeners
  document.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.onclick = (e) => {
      const id = e.currentTarget.dataset.id;
      items = items.filter((i) => i.id !== id);
      if (currentTurnIndex >= items.length && items.length > 0) {
        currentTurnIndex = items.length - 1;
      }
      render();
    };
  });

  adjustWindowHeight();
}

// Setup Event Listeners
function setupEventListeners() {
  // Tab Switching
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach((btn) => {
    btn.onclick = () => {
      const targetTab = btn.dataset.tab;

      tabBtns.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      btn.classList.add("active");
      const activeContent = document.getElementById(`${targetTab}-tab`);
      if (activeContent) activeContent.classList.add("active");

      adjustWindowHeight();
    };
  });

  // GM Controls
  safeAddListener("add-combatant-form", "submit", (e) => {
    e.preventDefault();
    const nameInput = document.getElementById("combatant-name");
    const initInput = document.getElementById("combatant-init");
    const hpInput = document.getElementById("combatant-hp");

    if (!nameInput || !nameInput.value.trim()) return;

    items.push({
      id: crypto.randomUUID(),
      name: nameInput.value.trim(),
      initiative: parseInt(initInput?.value, 10) || 0,
      hp: hpInput?.value !== "" ? parseInt(hpInput.value, 10) : "",
    });

    sortInitiative();
    nameInput.value = "";
    if (initInput) initInput.value = "";
    if (hpInput) hpInput.value = "";
    render();
  });

  safeAddListener("next-turn-btn", "click", () => {
    if (items.length === 0) return;
    currentTurnIndex++;
    if (currentTurnIndex >= items.length) {
      currentTurnIndex = 0;
      currentRound++;
    }
    render();
  });

  safeAddListener("prev-turn-btn", "click", () => {
    if (items.length === 0) return;
    currentTurnIndex--;
    if (currentTurnIndex < 0) {
      currentTurnIndex = items.length - 1;
      if (currentRound > 1) currentRound--;
    }
    render();
  });

  safeAddListener("reset-combat-btn", "click", () => {
    items = [];
    currentTurnIndex = 0;
    currentRound = 1;
    render();
  });
}

// Main Initialization Function
function init() {
  setupEventListeners();
  render();

  // OBR Role Check
  OBR.onReady(async () => {
    try {
      const role = await OBR.player.getRole();
      isGM = role === "GM";
      const app = document.getElementById("app");

      if (!isGM) {
        document.body.classList.add("player-mode");
        if (app) app.classList.add("player-view");
      } else {
        document.body.classList.remove("player-mode");
        if (app) app.classList.remove("player-view");
      }
      render();
    } catch (e) {
      console.warn("OBR role check skipped:", e);
    }
  });
}

// Run init once DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
