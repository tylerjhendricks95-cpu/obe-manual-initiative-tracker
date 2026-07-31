const CUSTOM_MONSTERS_KEY = "custom_monsters_data";
const PCS_KEY = "saved_pcs_data";

export function getCustomMonsters() {
  const data = localStorage.getItem(CUSTOM_MONSTERS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveCustomMonster(monster) {
  const monsters = getCustomMonsters();
  monsters.push(monster);
  localStorage.setItem(CUSTOM_MONSTERS_KEY, JSON.stringify(monsters));
}

export function deleteCustomMonster(id) {
  const monsters = getCustomMonsters().filter((m) => m.id !== id);
  localStorage.setItem(CUSTOM_MONSTERS_KEY, JSON.stringify(monsters));
}

// Player Character Storage
export function getSavedPCs() {
  const data = localStorage.getItem(PCS_KEY);
  return data ? JSON.parse(data) : [];
}

export function savePC(pc) {
  const pcs = getSavedPCs();
  const existingIdx = pcs.findIndex((p) => p.id === pc.id);
  if (existingIdx >= 0) {
    pcs[existingIdx] = pc;
  } else {
    pcs.push(pc);
  }
  localStorage.setItem(PCS_KEY, JSON.stringify(pcs));
}

export function deletePC(id) {
  const pcs = getSavedPCs().filter((p) => p.id !== id);
  localStorage.setItem(PCS_KEY, JSON.stringify(pcs));
}
