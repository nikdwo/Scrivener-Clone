// ProseMirror text and inline atoms both use UTF-16 positions; atoms stay as barriers.
export function proofBlocks(doc, from = 0, to = doc.content.size) {
  const blocks = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return;
    const start = Math.max(from, pos + 1), end = Math.min(to, pos + 1 + node.content.size);
    if (end <= start) return false;
    const text = node.textBetween(start - pos - 1, end - pos - 1, '', '\ufffc');
    let offset = 0;
    while (offset < text.length) {
      let length = Math.min(8000, text.length - offset);
      if (offset + length < text.length) {
        const boundary = text.slice(offset, offset + length).lastIndexOf(' ');
        if (boundary > 4000) length = boundary + 1;
        if (/[\uD800-\uDBFF]/.test(text[offset + length - 1])) length--;
      }
      const part = text.slice(offset, offset + length);
      if (part.trim()) blocks.push({id: blocks.length, text: part, from: start + offset});
      offset += length;
    }
    return false;
  });
  return blocks;
}

export function proofRange(blocks, issue) {
  const block = blocks.find(b => b.id === issue.block);
  if (!block || !Number.isInteger(issue.offset) || !Number.isInteger(issue.length) || issue.offset < 0 || issue.length < 1 || issue.offset + issue.length > block.text.length) return null;
  const original = block.text.slice(issue.offset, issue.offset + issue.length);
  if (original !== issue.original || original.includes('\ufffc')) return null;
  return {from: block.from + issue.offset, to: block.from + issue.offset + issue.length};
}
