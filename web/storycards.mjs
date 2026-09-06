export const cardFields = {
  figure: {role:'Rolle',motivation:'Motivation',conflict:'Konflikt',relationships:'Beziehungen',development:'Entwicklung',notes:'Notizen'},
  place: {atmosphere:'Atmosphäre',features:'Besondere Merkmale',significance:'Bedeutung für die Handlung',notes:'Notizen'},
  item: {description:'Beschreibung',features:'Besondere Merkmale',owner:'Besitzer / Zugehörigkeit',origin:'Herkunft',significance:'Bedeutung für die Handlung',notes:'Notizen'},
};
export const cardLabels = {figure:'Figur',place:'Ort',item:'Gegenstand'};
export const isStoryCard = d => !!d && Object.hasOwn(cardFields, d.meta?.storyCard?.type);
export function inManuscript(d, documents) {
  const seen = new Set();
  while (d && !seen.has(d.id)) {
    if (d.deleted) return false;
    if (d.id === 'manuscript') return true;
    seen.add(d.id); d = documents.find(p => p.id === d.parentId);
  }
  return false;
}
export const isScene = (d, documents) => !!d && ['text','script'].includes(d.kind) && !isStoryCard(d) && inManuscript(d, documents);

export function cardNameIndex(cards) {
  const names = new Map();
  for (const card of cards.filter(d => isStoryCard(d) && !d.deleted)) {
    for (const name of [card.title, ...(card.meta.storyCard.aliases ?? [])].map(s => s.trim()).filter(Boolean)) {
      if (!names.has(name)) names.set(name, new Set());
      names.get(name).add(card.id);
    }
  }
  return names;
}
export function findCardNames(text, start, names) {
    const word = /[\p{L}\p{M}\p{N}_]/u;
    const candidates = [];
    // ponytail: scan each known name in loaded paragraphs; use an indexed matcher if measured typing latency grows.
    for (const [name, ids] of names) {
      for (let at = text.indexOf(name); at >= 0; at = text.indexOf(name, at + 1)) {
        const end = at + name.length;
        if (word.test(text.slice(0, at).match(/.$/u)?.[0] ?? '') || word.test(text.slice(end).match(/^./u)?.[0] ?? '')) continue;
        candidates.push({from:start + at,to:start + end,name,ids:[...ids]});
      }
    }
    const accepted = [];
    for (const hit of candidates.sort((a,b) => (b.to-b.from)-(a.to-a.from) || a.from-b.from)) {
      let left=0,right=accepted.length;
      while(left<right){const middle=(left+right)>>>1;if(accepted[middle].from<hit.from)left=middle+1;else right=middle}
      if ((left>0&&accepted[left-1].to>hit.from)||(left<accepted.length&&accepted[left].from<hit.to)) continue;
      accepted.splice(left,0,hit);
    }
    return accepted;
}
export function cardMatches(doc, cards) {
  const names = cardNameIndex(cards), result = [];
  const scan = (text, start) => result.push(...findCardNames(text, start, names));
  doc.descendants((node, pos) => {
    if (node.type.name === 'codeBlock') return false;
    if (!node.isTextblock) return;
    let text = '', start = pos + 1;
    node.forEach((child, offset) => {
      if (child.isText && !child.marks.some(m => ['link','code'].includes(m.type.name))) {
        if (!text) start = pos + 1 + offset;
        text += child.text;
      } else { scan(text, start); text = ''; }
    });
    scan(text, start);
    return false;
  });
  return result;
}
