import OBR from "@owlbear-rodeo/sdk";
import defaultMonsters from "./monsters.json";
import { getCustomMonsters, saveCustomMonster, deleteCustomMonster } from "./store.js";

const METADATA_KEY = "com.custom.initiative/trackerState";

// Local state
let state = {
  combatants: [],
  activeIndex: 0
};

OBR.onReady(async () => {
  setupTabs();
  renderMonsterRepository();

  // Hide GM controls if viewer is a player
  const role = await OBR.player.getRole();
  if (role !== "GM") {
    document.getElementById("gm-controls").style.display = "none";
    document.querySelector(".combat-actions").style.display = "none";
  }

  // Subscribe to metadata updates across all clients (TV & GM screens)
  OBR.room.onMetadataChange((metadata) => {
    const roomState = metadata[METADATA_KEY];
    if (roomState) {
      state = roomState;
      renderTracker();
    }
  });

  // Fetch initial state
  const initialMetadata = await OBR.room.getMetadata();
  if (initialMetadata[METADATA_KEY]) {
    state = initialMetadata[METADATA_KEY];
    renderTracker();
  }
});

// Update State in Room Metadata
async function syncState() {
  await OBR.room.setMetadata({ [METADATA_KEY]: state });
}

// Add Combatant (Manual / Mini)
document.getElementById("add-btn").addEventListener("click", () => {
  const name = document.getElementById("add-name").value.trim();
  const init = parseInt(document.getElementById("add-init").value, 10);

  if (!name || isNaN(init)) return;

  state.combatants.push({
    id: crypto.randomUUID(),
    name,
    initiative: init,
    tokenId: null
  });

  state.combatants.sort((a, b) => b.initiative - a.initiative);
  syncState();

  document.getElementById("add-name").value = "";
  document.getElementById("add-init").value = "";
});

// Link Active Token to Next Combatant
document.getElementById("add-selected-token-btn").addEventListener("click", async () => {
  const selection = await OBR.player.getSelection();
  const name = document.getElementById("add-name").value.trim() || "Token Combatant";
  const init = parseInt(document.getElementById("add-init").value, 10) || 10;

  const tokenId = selection && selection.length > 0 ? selection[0] : null;

  state.combatants.push({
    id: crypto.randomUUID(),
    name,
    initiative: init,
    tokenId
  });

  state.combatants.sort((a, b) => b.initiative - a.initiative);
  syncState();
});

// Next Turn Button & Token Highlighting
document.getElementById("next-turn-btn").addEventListener("click", async () => {
  if (state.combatants.length === 0) return;

  state.activeIndex = (state.activeIndex + 1) % state.combatants.length;
  const current = state.combatants[state.activeIndex];

  // Highlight Token if bound to a map item
  if (current.tokenId) {
    await OBR.scene.items.updateItems(
      (item) => item.id === current.tokenId,
      (items) => {
        items.forEach((item) => {
          item.scale = { x: 1.2, y: 1.2 }; // Enlarges current monster on TV
        });
      }
    );
  }

  syncState();
});

// Reset Combat
document.getElementById("reset-combat-btn").addEventListener("click", () => {
  state = { combatants: [], activeIndex: 0 };
  syncState();
});

// Custom Monster Creator Form
document.getElementById("create-monster-form").addEventListener("submit", (e) => {
  e.preventDefault();

  const newMonster = {
    id: crypto.randomUUID(),
    name: document.getElementById("m-name").value,
    type: document.getElementById("m-type").value || "Custom",
    cr: document.getElementById("m-cr").value || "1",
    hp: parseInt(document.getElementById("m-hp").value, 10),
    ac: parseInt(document.getElementById("m-ac").value, 10),
    initMod: parseInt(document.getElementById("m-init").value, 10) || 0,
    notes: document.getElementById("m-notes").value
  };

  saveCustomMonster(newMonster);
  e.target.reset();
  renderMonsterRepository();
});

// Render Main Tracker
function renderTracker() {
  const list = document.getElementById("initiative-list");
  list.innerHTML = "";

  state.combatants.forEach((c, idx) => {
    const card = document.createElement("div");
    card.className = `card ${idx === state.activeIndex ? "turn-active" : ""}`;
    card.innerHTML = `
      <div>
        <strong>${c.name}</strong> ${c.tokenId ? "🔗" : "(Physical Mini)"}
      </div>
      <div>Init: <strong>${c.initiative}</strong></div>
    `;
    list.appendChild(card);
  });
}

// Render Monster Repository List
function renderMonsterRepository() {
  const container = document.getElementById("monster-repository");
  const allMonsters = [...defaultMonsters, ...getCustomMonsters()];
  container.innerHTML = "";

  allMonsters.forEach((m) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div>
        <strong>${m.name}</strong> <span style="color:var(--muted)">(CR ${m.cr})</span>
        <div style="font-size:11px; color:var(--muted)">HP: ${m.hp} | AC: ${m.ac}</div>
      </div>
      <button class="btn btn-primary" onclick="addMonsterToCombat('${m.id}')">+ Add</button>
    `;
    container.appendChild(card);
  });
}

window.addMonsterToCombat = function (id) {
  const allMonsters = [...defaultMonsters, ...getCustomMonsters()];
  const monster = allMonsters.find((m) => m.id === id);
  if (!monster) return;

  const d20Roll = Math.floor(Math.random() * 20) + 1;
  const init = d20Roll + monster.initMod;

  state.combatants.push({
    id: crypto.randomUUID(),
    name: monster.name,
    initiative: init,
    tokenId: null
  });

  state.combatants.sort((a, b) => b.initiative - a.initiative);
  syncState();
};

function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });
}
