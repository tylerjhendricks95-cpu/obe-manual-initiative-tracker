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
  // Set toolbar icon and tooltip title
  await OBR.action.setIcon("/icon.png");
  await OBR.action.setTitle("Initiative Tracker");

  setupTabs();
  renderMonsterRepository();
  setupSearchListener();

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
    hp: 10,
    maxHp: 10,
    tokenId: null
  });

  state.combatants.sort((a, b) => b.initiative - a.initiative);
  renderTracker();
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
    hp: 10,
    maxHp: 10,
    tokenId
  });

  state.combatants.sort((a, b) => b.initiative - a.initiative);
  renderTracker();
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

  renderTracker();
  syncState();
});

// Reset Combat
document.getElementById("reset-combat-btn").addEventListener("click", () => {
  state = { combatants: [], activeIndex: 0 };
  renderTracker();
  syncState();
});

// Custom Monster Creator Form
document.getElementById("create-monster-form").addEventListener("submit", (e) => {
  e.preventDefault();

  const newMonster = {
    id: crypto.randomUUID(),
    name: document.getElementById("m-name").value,
    meta: document.getElementById("m-type").value || "Custom",
    Challenge: document.getElementById("m-cr").value || "1",
    "Hit Points": document.getElementById("m-hp").value,
    "Armor Class": document.getElementById("m-ac").value,
    DEX_mod: `(${document.getElementById("m-init").value || 0})`,
    notes: document.getElementById("m-notes").value
  };

  saveCustomMonster(newMonster);
  e.target.reset();
  renderMonsterRepository();
});

// Adjust Combatant HP
function changeHp(combatantId, amount) {
  const combatant = state.combatants.find((c) => c.id === combatantId);
  if (!combatant) return;

  const currentHp = combatant.hp ?? combatant.maxHp ?? 10;
  combatant.hp = Math.max(0, currentHp + amount);

  renderTracker();
  syncState();
}

// Prompt to manually override HP
function setManualHp(combatantId) {
  const combatant = state.combatants.find((c) => c.id === combatantId);
  if (!combatant) return;

  const currentHp = combatant.hp ?? combatant.maxHp ?? 10;
  const newHpStr = prompt(`Set HP for ${combatant.name}:`, currentHp);
  
  if (newHpStr !== null) {
    const parsed = parseInt(newHpStr, 10);
    if (!isNaN(parsed)) {
      combatant.hp = Math.max(0, parsed);
      renderTracker();
      syncState();
    }
  }
}

// Remove combatant from list
function removeCombatant(combatantId) {
  state.combatants = state.combatants.filter((c) => c.id !== combatantId);
  if (state.activeIndex >= state.combatants.length) {
    state.activeIndex = 0;
  }
  renderTracker();
  syncState();
}

// Render Main Tracker
function renderTracker() {
  const list = document.getElementById("initiative-list");
  if (!list) return;
  list.innerHTML = "";

  state.combatants.forEach((c, idx) => {
    const card = document.createElement("div");
    card.className = `card ${idx === state.activeIndex ? "turn-active" : ""}`;

    const hp = c.hp ?? c.maxHp ?? "N/A";
    const maxHpDisplay = c.maxHp ? ` / ${c.maxHp}` : "";
    const isUnconscious = typeof hp === "number" && hp <= 0;

    card.innerHTML = `
      <div style="display:flex; justify-between; align-items:center; margin-bottom: 6px;">
        <div>
          <strong>${c.name}</strong> ${c.tokenId ? "🔗" : ""}
          ${isUnconscious ? '<span style="color:#ff4d4d; font-size:11px; margin-left: 5px;">(Unconscious)</span>' : ''}
        </div>
        <div>Init: <strong>${c.initiative}</strong></div>
      </div>
      
      <div style="display:flex; align-items:center; gap: 4px; font-size: 12px; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 4px;">
        <span style="font-weight:bold; margin-right: 4px;">HP:</span>
        <button class="btn-sm hp-btn" data-id="${c.id}" data-change="-5">-5</button>
        <button class="btn-sm hp-btn" data-id="${c.id}" data-change="-1">-1</button>
        <span class="hp-val" data-id="${c.id}" style="cursor:pointer; font-weight:bold; padding: 0 4px;" title="Click to set HP directly">
          ${hp}${maxHpDisplay}
        </span>
        <button class="btn-sm hp-btn" data-id="${c.id}" data-change="1">+1</button>
        <button class="btn-sm hp-btn" data-id="${c.id}" data-change="5">+5</button>
        <button class="remove-btn" data-id="${c.id}" style="margin-left:auto; background:none; border:none; color:#ff4d4d; cursor:pointer; font-size:14px;">✕</button>
      </div>
    `;

    // Event listeners for HP adjustments
    card.querySelectorAll(".hp-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const change = parseInt(btn.dataset.change, 10);
        changeHp(id, change);
      });
    });

    // Event listener for manual HP override click
    card.querySelector(".hp-val").addEventListener("click", (e) => {
      e.stopPropagation();
      setManualHp(btn.dataset.id);
    });

    // Remove combatant button
    card.querySelector(".remove-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      removeCombatant(c.id);
    });

    list.appendChild(card);
  });
}

// Render Monster Repository List with Search Filtering
function renderMonsterRepository(filterQuery = "") {
  const container = document.getElementById("monster-repository");
  if (!container) return;

  const allMonsters = [...defaultMonsters, ...getCustomMonsters()];
  container.innerHTML = "";

  const query = filterQuery.toLowerCase().trim();

  if (!query) {
    container.innerHTML = `<div style="padding: 10px; color: var(--muted); text-align: center;">Type in the search bar to find monsters</div>`;
    return;
  }

  // Filter full dataset by name or metadata/type
  const filteredMonsters = allMonsters.filter((m) => {
    const nameMatch = m.name && m.name.toLowerCase().includes(query);
    const metaMatch = typeof m.meta === "string" && m.meta.toLowerCase().includes(query);
    const typeMatch = typeof m.type === "string" && m.type.toLowerCase().includes(query);
    return nameMatch || metaMatch || typeMatch;
  });

  if (filteredMonsters.length === 0) {
    container.innerHTML = `<div style="padding: 10px; color: var(--muted); text-align: center;">No monsters found</div>`;
    return;
  }

  // Cap visible matches at 30 to keep rendering smooth
  filteredMonsters.slice(0, 30).forEach((m) => {
    const card = document.createElement("div");
    card.className = "card";
    
    // Safely parse properties matching the new JSON schema
    const cr = m.Challenge ?? m.cr ?? 'N/A';
    const hp = m["Hit Points"] ?? m.hp ?? 'N/A';
    const ac = m["Armor Class"] ?? m.ac ?? 'N/A';

    card.innerHTML = `
      <div>
        <strong>${m.name}</strong> <span style="color:var(--muted)">(CR ${cr})</span>
        <div style="font-size:11px; color:var(--muted)">HP: ${hp} | AC: ${ac}</div>
      </div>
      <button class="btn btn-primary add-btn">+ Add</button>
    `;

    card.querySelector(".add-btn").addEventListener("click", () => {
      addMonsterObjToCombat(m);
    });

    container.appendChild(card);
  });
}

// Bind search input event listener using matching element ID
function setupSearchListener() {
  const searchInput = document.getElementById("search-monsters");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      renderMonsterRepository(e.target.value);
    });
  }
}

function addMonsterObjToCombat(monster) {
  const d20Roll = Math.floor(Math.random() * 20) + 1;
  
  // Extract DEX modifier number from formats like "(+5)", "(-1)", or standard integer
  let initMod = 0;
  if (monster.DEX_mod) {
    const parsed = parseInt(monster.DEX_mod.replace(/[^0-9-]/g, ''), 10);
    if (!isNaN(parsed)) initMod = parsed;
  } else if (monster.initMod) {
    initMod = parseInt(monster.initMod, 10) || 0;
  }

  // Extract baseline numerical HP (e.g. extracts 135 from "135 (18d10 + 36)")
  let parsedHp = 10;
  const rawHp = monster["Hit Points"] ?? monster.hp;
  if (typeof rawHp === "number") {
    parsedHp = rawHp;
  } else if (typeof rawHp === "string") {
    const hpMatch = rawHp.match(/\d+/);
    if (hpMatch) parsedHp = parseInt(hpMatch[0], 10);
  }

  const init = d20Roll + initMod;

  state.combatants.push({
    id: crypto.randomUUID(),
    name: monster.name,
    initiative: init,
    hp: parsedHp,
    maxHp: parsedHp,
    tokenId: null
  });

  state.combatants.sort((a, b) => b.initiative - a.initiative);
  renderTracker();
  syncState();
}

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
