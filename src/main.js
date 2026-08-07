import OBR from "@owlbear-rodeo/sdk";

// Unique Key for Owlbear Room Metadata Storage
const ID = "com.initiative-tracker.app";
const METADATA_KEY = `${ID}/metadata`;
const LOCAL_STORAGE_KEY = "initiative_tracker_saved_party";

// Local State
let state = {
  items: [],
  currentTurnIndex: 0,
  currentRound: 1,
};
let isGM = true;

// Helper: Add Event Listener Safely with preventDefault
function safeAddListener(id, event, handler) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener(event, (e) => {
      e.preventDefault();
      handler(e);
    });
  }
}

// Save State to Owlbear Rodeo Room
async function saveState() {
  if (OBR.isReady && isGM) {
    await OBR.room.setMetadata({
      [METADATA_KEY]: state,
    });
  } else {
    render();
  }
}

// Logic Helpers
function sortInitiative() {
  state.items.sort((a, b) => b.initiative - a.initiative);
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

  if (roundEl) roundEl.textContent = state.currentRound;

  if (initiativeList) {
    initiativeList.innerHTML = "";

    if (state.items.length === 0) {
      initiativeList.innerHTML = `<div style="color: var(--muted); text-align: center; padding: 12px;">No combatants added.</div>`;
    } else {
      state.items.forEach((item, index) => {
        const isCurrentTurn = index === state.currentTurnIndex;
        const card = document.createElement("div");
        card.className = `card ${isCurrentTurn ? "turn-active" : ""}`;

        const removeBtnHTML = isGM
          ? `<button type="button" class="btn btn-secondary btn-sm remove-btn" data-id="${item.id}">✕</button>`
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
  if (isGM) {
    document.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        const id = e.currentTarget.dataset.id;
        state.items = state.items.filter((i) => i.id !== id);
        if (state.currentTurnIndex >= state.items.length && state.items.length > 0) {
          state.currentTurnIndex = state.items.length - 1;
        }
        saveState();
      };
    });
  }

  adjustWindowHeight();
}

// Setup Event Listeners
function setupEventListeners() {
  // TAB SWITCHING FIX
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault(); // Stop iframe reload
      e.stopPropagation();

      const targetTab = btn.getAttribute("data-tab");

      // Remove active class from all tabs & content containers
      tabBtns.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => {
        c.classList.remove("active");
        c.style.display = "none"; // Explicit hide
      });

      // Activate current tab
      btn.classList.add("active");
      
      const activeContent = document.getElementById(`${targetTab}-tab`);
      if (activeContent) {
        activeContent.classList.add("active");
        activeContent.style.display = "block"; // Explicit show
      }

      adjustWindowHeight();
    });
  });

  // Add Combatant Form
  safeAddListener("add-combatant-form", "submit", () => {
    const nameInput = document.getElementById("combatant-name");
    const initInput = document.getElementById("combatant-init");
    const hpInput = document.getElementById("combatant-hp");

    if (!nameInput || !nameInput.value.trim()) return;

    state.items.push({
      id: crypto.randomUUID(),
      name: nameInput.value.trim(),
      initiative: parseInt(initInput?.value, 10) || 0,
      hp: hpInput?.value !== "" ? parseInt(hpInput.value, 10) : "",
    });

    sortInitiative();
    nameInput.value = "";
    if (initInput) initInput.value = "";
    if (hpInput) hpInput.value = "";
    saveState();
  });

  // Next Turn Button
  safeAddListener("next-turn-btn", "click", () => {
    if (state.items.length === 0) return;
    state.currentTurnIndex++;
    if (state.currentTurnIndex >= state.items.length) {
      state.currentTurnIndex = 0;
      state.currentRound++;
    }
    saveState();
  });

  // Previous Turn Button
  safeAddListener("prev-turn-btn", "click", () => {
    if (state.items.length === 0) return;
    state.currentTurnIndex--;
    if (state.currentTurnIndex < 0) {
      state.currentTurnIndex = state.items.length - 1;
      if (state.currentRound > 1) state.currentRound--;
    }
    saveState();
  });

  // Reset Combat Button
  safeAddListener("reset-combat-btn", "click", () => {
    state.items = [];
    state.currentTurnIndex = 0;
    state.currentRound = 1;
    saveState();
  });

  // Save / Load Party Presets
  safeAddListener("save-party-btn", "click", () => {
    if (state.items.length === 0) {
      alert("Add some party members before saving!");
      return;
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state.items));
    alert("Party saved!");
  });

  safeAddListener("load-party-btn", "click", () => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!saved) {
      alert("No saved party found!");
      return;
    }

    const savedParty = JSON.parse(saved);
    const partyWithNewIds = savedParty.map((member) => ({
      ...member,
      id: crypto.randomUUID(),
    }));

    state.items = [...state.items, ...partyWithNewIds];
    sortInitiative();
    saveState();
  });
}

// Main Initialization Function
function init() {
  setupEventListeners();
  render();

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

      const metadata = await OBR.room.getMetadata();
      if (metadata[METADATA_KEY]) {
        state = metadata[METADATA_KEY];
      }
      render();

      OBR.room.onMetadataChange((updatedMetadata) => {
        if (updatedMetadata[METADATA_KEY]) {
          state = updatedMetadata[METADATA_KEY];
          render();
        }
      });
    } catch (e) {
      console.warn("OBR SDK error:", e);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
