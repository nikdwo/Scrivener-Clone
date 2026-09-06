export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function orderedDocuments(documents, root, includeRoot = false) {
  const map = new Map();
  for (const doc of documents) if (!doc.deleted) { const list = map.get(doc.parentId) ?? []; list.push(doc); map.set(doc.parentId, list); }
  for (const list of map.values()) list.sort((a,b) => a.position-b.position || a.id.localeCompare(b.id));
  const result = [], seen = new Set();
  function walk(id) { if (seen.has(id)) throw new Error('Zyklische Projektstruktur.'); seen.add(id); for (const d of map.get(id) ?? []) { result.push(d); walk(d.id); } }
  if (includeRoot) { const d = documents.find(d => d.id === root && !d.deleted); if (d) result.push(d); }
  walk(root); return result;
}
export function plainText(root) {
  if (typeof root === 'string') root = JSON.parse(root);
  let text = '';
  function walk(n) { if (n.type === 'footnote') return; if (n.text) text += n.text; for (const c of n.content ?? []) walk(c); if (['paragraph','heading','hardBreak','script'].includes(n.type)) text += '\n'; }
  walk(root); return text.trimEnd();
}
export const wordCount = text => (text.match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’\-][\p{L}\p{M}\p{N}]+)*/gu) ?? []).length;
export function matchesCollection(doc, collection) {
  if (collection.ids) return collection.ids.includes(doc.id);
  const haystack = [doc.title, doc.meta?.synopsis, doc.meta?.status, doc.meta?.tags, JSON.stringify(doc.meta?.custom ?? {})].join(' ').toLocaleLowerCase('de');
  return !doc.deleted && haystack.includes((collection.query ?? '').toLocaleLowerCase('de'));
}
