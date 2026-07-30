const CUSTOM_MONSTERS_KEY = "obr_custom_monsters_v1";

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

