import { state, save } from './storage.js';

export function createBox(set) {
  const id = 'box_' + Date.now();
  state.boxes[id] = { id, setId: set.id, setName: set.name,
    logo: set.images?.logo || '', symbol: set.images?.symbol || '',
    total: 36, opened: [], lidOpen: false };
  state.activeBoxId = id; save();
  return state.boxes[id];
}
export const activeBox = () => state.boxes[state.activeBoxId] || null;
export function openPackAt(box, i) { if (!box.opened.includes(i)) { box.opened.push(i); save(); } }
export const remaining = box => box.total - box.opened.length;
