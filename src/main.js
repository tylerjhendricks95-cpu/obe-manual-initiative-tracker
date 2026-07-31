import OBR from "@owlbear-rodeo/sdk";
import defaultMonsters from "./monsters.json";
import { 
  getCustomMonsters, 
  saveCustomMonster, 
  getSavedPCs, 
  savePC, 
  deletePC 
} from "./store.js";

const METADATA_KEY = "com.custom.initiative/trackerState";

let state = {
  combatants: [],
  activeIndex: 0
};

let userRole = "PLAYER";

OBR.onReady(async () => {
  await OBR.action.setIcon("/icon.png");
  await OBR.action.setTitle("Initiative Tracker");

  userRole = await OBR.player.getRole();

  if (userRole !== "GM") {
    const gmControls = document.getElementById("gm-controls");
    const combatActions = document.querySelector(".combat-actions");
    if (gmControls) gmControls.style.display = "none";
    if (combatActions) combatActions.style.display = "none";

    document.querySelector(".app-container")?.classList.add("player-view");
  }

  setupTabs();
  renderMonsterRepository();
  setupSearchListener();
  renderPartyList();
  setupPartyForm();

  OBR.room.onMetadataChange((metadata) => {
    const roomState = metadata[METADATA_KEY];
    if (roomState) {
      state = roomState;
      renderTracker();
    }
  });

  const initialMetadata = await OBR.room.getMetadata();
  if (initialMetadata[METADATA_KEY]) {
    state = initialMetadata[METADATA_KEY];
    renderTracker();
  }
});

async function syncState() {
  await OBR.room.setMetadata({ [METADATA_KEY]: state });
}

document.getElementById("add-btn")?.addEventListener("click", () => {
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

document.getElementById("add-selected-token-btn")?.addEventListener("click", async () => {
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

document.getElementById("next-turn-btn")?.addEventListener("click", async () => {
  if (state.combatants.length === 0) return;

  state.activeIndex = (state.activeIndex + 1) % state.combatants.length;
  const current = state.combatants[state.activeIndex];

  if (current.tokenId) {
    await OBR.scene.items.updateItems(
      (item) => item.id === current.tokenId,
      (items) => {
        items.forEach((item) => {
          item.scale = { x: 1.2, y: 1.2 };
        });
      }
    );
  }

  renderTracker();
  syncState();
});

document.getElementById("reset-combat-btn")?.addEventListener("click", () => {
  state = { combatants: [], activeIndex: 0 };
  renderTracker();
  syncState();
});

function setupPartyForm() {
  const form = document.getElementById("pc-form");
  const cancelBtn = document.getElementById("pc-cancel-btn");

  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const editId = document.getElementById("pc-edit-id").value;

    const pc = {
      id: editId ? editId : crypto.randomUUID(),
      name: document.getElementById("pc-name").value.trim(),
      hp: parseInt(document.getElementById("pc-hp").value, 10),
      init: parseInt(document.getElementById("pc-init").value, 10) || 0,
      group: document.getElementById("pc-group").value.trim() || "Default Party"
    };

    savePC(pc);
    resetPCForm();
    renderPartyList();
  });

  cancelBtn?.addEventListener("click", resetPCForm);
}

function resetPCForm() {
  const form = document.getElementById("pc-form");
  if (form) form.reset();

  const editId = document.getElementById("pc-edit-id");
  if (editId) editId.value = "";

  const submitBtn = document.getElementById("pc-submit-btn");
  if (submitBtn) submitBtn.textContent = "Save Player";

  const cancelBtn = document.getElementById("pc-cancel-btn");
  if (cancelBtn) cancelBtn.style.display = "none";
}

function editPC(pc) {
  document.getElementById("pc-edit-id").value = pc.id;
  document.getElementById("pc-name").value = pc.name;
  document.getElementById("pc-hp").value = pc.hp;
  document.getElementById("pc-init").value = pc.init;
  document.getElementById("pc-group").value = pc.group;

  document.getElementById("pc-submit-btn").textContent = "Update Player";
  document.getElementById("pc-cancel-btn").style.display = "inline-block";
}

function renderPartyList() {
  const container = document.getElementById("party-list");
  if (!container) return;

  const pcs = getSavedPCs();
  container.innerHTML = "";

  if (pcs.length === 0) {
    container.innerHTML = `<div style="padding: 10px; color: var(--muted); text-align: center;">No player characters saved yet.</div>`;
    return;
  }

  const groups = {};
  pcs.forEach((pc) => {
    const gName = pc.group || "Default Party";
    if (!groups[gName]) groups[gName] = [];
    groups[gName].push(pc);
  });

  Object.keys(groups).forEach((groupName) => {
    const groupHeader = document.createElement("div");
    groupHeader.className = "group-header";
    groupHeader.innerHTML = `
      <strong style="color:var(--accent,#4da6ff);">${groupName}</strong>
      ${userRole === "GM" ? '<button class="btn btn-secondary btn-sm add-group-btn">+ Add Group to Combat</button>' : ''}
    `;

    if (userRole === "GM") {
      groupHeader.querySelector(".add-group-btn").addEventListener("click", () => {
        groups[groupName].forEach((pc) => addPcToCombat(pc));
      });
    }

    container.appendChild(groupHeader);

    groups[groupName].forEach((pc) => {
      const card = document.createElement("div");
      card.className = "card";
      card.style.marginTop = "6px";
      card.innerHTML = `
        <div>
          <strong>${pc.name}</strong>
          <div style="font-size:11px; color:var(--muted)">HP: ${pc.hp} | Init/Mod: ${pc.init}</div>
        </div>
        ${
          userRole === "GM"
            ? `<div style="display:flex; gap:4px;">
                <button class="btn btn-primary btn-sm add-pc-btn">+ Add</button>
                <button class="btn btn-secondary btn-sm edit-pc-btn">✏️</button>
                <button class="btn-sm delete-pc-btn" style="background:none; border:none; color:#ff4d4d; cursor:pointer;">✕</button>
               </div>`
            : ""
        }
      `;

      if (userRole === "GM") {
        card.querySelector(".add-pc-btn").addEventListener("click", () => addPcToCombat(pc));
        card.querySelector(".edit-pc-btn").addEventListener("click", () => editPC(pc));
        card.querySelector(".delete-pc-btn").addEventListener("click", () => {
          deletePC(pc.id);
          renderPartyList();
        });
      }

      container.appendChild(card);
    });
  });
}

function addPcToCombat(pc) {
  state.combatants.push({
    id: crypto.randomUUID(),
    name: pc.name,
    initiative: pc.init,
    hp: pc.hp,
    maxHp: pc.hp,
    tokenId: null
  });

  state.combatants.sort((a, b) => b.initiative - a.initiative);
  renderTracker();
  syncState();
}

const createMonsterForm = document.getElementById("create-monster-form");
if (createMonsterForm) {
  createMonsterForm.addEventListener("submit", (e) => {
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
}

function changeHp(combatantId, amount) {
  if (userRole !== "GM") return;
  const combatant = state.combatants.find((c) => c.id === combatantId);
  if (!combatant) return;

  const currentHp = combatant.hp ?? combatant.maxHp ?? 10;
  combatant.hp = Math.max(0, currentHp + amount);

  renderTracker();
  syncState();
}

function setManualHp(combatantId) {
  if (userRole !== "GM") return;
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

function removeCombatant(combatantId) {
  if (userRole !== "GM") return;
  state.combatants = state.combatants.filter((c) => c.id !== combatantId);
  if (state.activeIndex >= state.combatants.length) {
    state.activeIndex = 0;
  }
  renderTracker();
  syncState();
}

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

    if (userRole === "GM") {
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
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

      card.querySelectorAll(".hp-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          changeHp(btn.dataset.id, parseInt(btn.dataset.change, 10));
        });
      });

      card.querySelector(".hp-val").addEventListener("click", (e) => {
        e.stopPropagation();
        setManualHp(c.id);
      });

      card.querySelector(".remove-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        removeCombatant(c.id);
      });
    } else {
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong>${c.name}</strong>
            ${isUnconscious ? '<span style="color:#ff4d4d; font-size:11px; margin-left: 5px;">(Unconscious)</span>' : ''}
          </div>
          <div>Init: <strong>${c.initiative}</strong></div>
        </div>
      `;
    }

    list.appendChild(card);
  });
}

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

  filteredMonsters.slice(0, 30).forEach((m) => {
    const card = document.createElement("div");
    card.className = "card";
    
    const cr = m.Challenge ?? m.cr ?? 'N/A';
    const hp = m["Hit Points"] ?? m.hp ?? 'N/A';
    const ac = m["Armor Class"] ?? m.ac ?? 'N/A';

    card.innerHTML = `
      <div>
        <strong>${m.name}</strong> <span style="color:var(--muted)">(CR ${cr})</span>
        <div style="font-size:11px; color:var(--muted)">HP: ${hp} | AC: ${ac}</div>
      </div>
      ${userRole === "GM" ? '<button class="btn btn-primary add-btn">+ Add</button>' : ''}
    `;

    if (userRole === "GM") {
      card.querySelector(".add-btn").addEventListener("click", () => {
        addMonsterObjToCombat(m);
      });
    }

    container.appendChild(card);
  });
}

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
  let initMod = 0;
  if (monster.DEX_mod) {
    const parsed = parseInt(monster.DEX_mod.replace(/[^0-9-]/g, ''), 10);
    if (!isNaN(parsed)) initMod = parsed;
  } else if (monster.initMod) {
    initMod = parseInt(monster.initMod, 10) || 0;
  }

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
      document.getElementById(btn.dataset.tab)?.classList.add("active");
    });
  });
}
