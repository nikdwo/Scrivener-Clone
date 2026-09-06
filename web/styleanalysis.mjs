import {cardNameIndex, findCardNames} from './storycards.mjs';

export const styleDefaults = Object.freeze({repetitions:true, sentences:true, wording:true, automatic:false});
export function styleSettings(value) {
  return Object.fromEntries(Object.entries(styleDefaults).map(([key, fallback]) => [key, typeof value?.[key] === 'boolean' ? value[key] : fallback]));
}
// Small, explicit exclusion list, not a grammatical classifier. Keep the list in STILANALYSE.md in sync.
export const repetitionStopWords = new Set(('habe haben habt hast hätte hätten bist seid wäre wären dein deine deiner deines deinem deinen eurem deren denen sollte sollten konnte konnten könnten dürfen durfte durften dürfte dürften musste mussten müsste müssten mögen möchte möchten wollen wollte wollten will aber also auch beim bereits besonders danach dann darauf darum dazu denn deshalb dessen diese dieser dieses diesem diesen doch dort durch eine einer eines einem einen etwas eure euren eurer eures hatte hatten hier hinter ihre ihrer ihres ihrem ihren immer jede jeder jedes jedem jeden jene jener jenes jenem jenen kann keine keiner keines keinem keinen könnte können meine meiner meines meinem meinen mich mehr muss müssen nach neben nicht noch oder ohne sehr sein seine seiner seines seinem seinen selbst sich sind soll sollen sondern über ihre unter unsere unserer unseres unserem unseren viele vielleicht vom wann waren warum weil welche welcher welches welchem welchen wenn werde werden wird wurde wurden würde würden zum zwischen').split(' '));
export const wordingPhrases = ['eigentlich','irgendwie','gewissermaßen','gewissermassen','sozusagen','quasi','letztendlich','im Grunde genommen','letzten Endes','an und für sich','zum jetzigen Zeitpunkt'];
const normalize = text => text.normalize('NFC').toLocaleLowerCase('de');
// Same Unicode word definition as the editor's word counter, with offsets for navigation.
const tokens = text => [...text.matchAll(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’\-][\p{L}\p{M}\p{N}]+)*/gu)].map(m => ({text:m[0], start:m.index, end:m.index+m[0].length}));
const phraseTokens = wordingPhrases.map(phrase => tokens(phrase).map(t => normalize(t.text))).sort((a,b) => b.length-a.length);

function sentenceText(text) {
  // Mask only analysis text, one UTF-16 character per period; original text and positions remain intact.
  const mask = value => value.replaceAll('.', '\u2060');
  return text
    .replace(/\b(?:z\.\s*B\.|d\.\s*h\.|u\.\s*a\.|u\.\s*U\.|v\.\s*a\.|i\.\s*d\.\s*R\.)/giu, mask)
    .replace(/\b(?:Dr|Prof|Dipl|Ing|Nr|Abb|ca|bzw|vgl|Hr|Fr)\.(?=\s*\p{L})/giu, mask)
    .replace(/\b\d{1,2}\.(?=\s*(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\b)/giu, mask)
    .replace(/\b\p{Lu}\.(?=\s*\p{Lu}\p{Ll})/gu, mask)
    .replace(/\b(?:usw|etc)\.(?=\s+\p{Ll})/gu, mask);
}

function textRuns(doc, from, to) {
  const runs = []; let group = 0, count = 0;
  function visit(node, pos) {
    if (pos >= to || pos + node.nodeSize <= from) return;
    if (['heading','codeBlock'].includes(node.type.name) || node.isAtom) { group++; return; }
    if (node.isTextblock) {
      let text = '', start = pos + 1;
      const flush = () => {
        if (text && start < to && start + text.length > from) {
          count += Math.min(to,start+text.length)-Math.max(from,start);
          if (count > 1_000_000) throw new Error('Bitte einen Textabschnitt oder eine Markierung mit höchstens einer Million Zeichen analysieren.');
          runs.push({text, start, group});
        }
        text = '';
      };
      node.forEach((child, offset) => {
        if (child.isText && !child.marks.some(mark => mark.type.name === 'code')) {
          if (!text) start = pos + 1 + offset;
          text += child.text;
        } else { flush(); group++; }
      });
      flush(); return;
    }
    const boundary = ['tableCell','tableHeader','listItem'].includes(node.type.name);
    if (boundary) group++;
    node.forEach((child, offset) => visit(child, pos + 1 + offset));
    if (boundary) group++;
  }
  visit(doc, -1); return runs;
}

/** Local analysis only. Findings use the existing proof panel's ranges/issue shape. */
export async function analyzeStyle(doc, {from=0, to=doc.content.size, language='de-DE', settings=styleSettings(null), cards=[], signal=null} = {}) {
  if (!['de-DE','de-AT','de-CH'].includes(language)) throw new Error('Die Stilanalyse unterstützt Deutsch (Deutschland, Österreich und Schweiz).');
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to > doc.content.size || to < from) throw new Error('Ungültige Textauswahl.');
  settings = styleSettings(settings);
  const runs = textRuns(doc, from, to), findings = [], sentences = [], names = cardNameIndex(cards);
  const segmenter = new Intl.Segmenter(language, {granularity:'sentence'});
  let previousGroup = -1, wordIndex = 0, sentenceIndex = 0, lastYield = performance.now();
  const previous = new Map();
  async function checkpoint(force=false) {
    signal?.throwIfAborted();
    if (force || performance.now()-lastYield >= 8) {
      await new Promise(resolve => setTimeout(resolve,0)); signal?.throwIfAborted(); lastYield = performance.now();
    }
  }
  function finding(rule, start, end, text, message) {
    findings.push({id:findings.length, from:start, to:end, issue:{category:'style',rule,original:text,message,replacements:[]}});
  }
  await checkpoint(true);
  for (const run of runs) {
    if (run.group !== previousGroup) { previous.clear(); previousGroup=run.group; }
    const named = settings.repetitions ? findCardNames(run.text,run.start,names) : [];
    let namedIndex = 0;
    for (const segment of segmenter.segment(sentenceText(run.text))) {
      await checkpoint();
      const original = run.text.slice(segment.index,segment.index+segment.segment.length);
      const fullStart = run.start + segment.index + original.length-original.trimStart().length;
      const fullEnd = run.start + segment.index + original.trimEnd().length;
      const start = Math.max(from, fullStart), end = Math.min(to, fullEnd);
      if (end <= start) continue;
      const text = run.text.slice(start-run.start,end-run.start), words = tokens(text), fragment = start > fullStart || end < fullEnd;
      if (!words.length) continue;
      const sentence = {from:start,to:end,words:words.length,fragment};
      sentences.push(sentence); sentenceIndex++;
      if (settings.sentences && !fragment && words.length >= 30) finding('sentence-length',start,end,text,`${words.length >= 45 ? 'Sehr langer' : 'Langer'} Satz mit ${words.length} Wörtern. Prüfe, ob eine Teilung den Lesefluss unterstützt; die Länge allein ist kein Fehler.`);
      for (let i=0;i<words.length;i++) {
        if (i % 256 === 0) await checkpoint();
        const word = words[i], normalized = normalize(word.text), at = start+word.start, until = start+word.end;
        while (namedIndex < named.length && named[namedIndex].to <= at) namedIndex++;
        const isName = namedIndex < named.length && named[namedIndex].from <= at && named[namedIndex].to >= until;
        if (settings.repetitions && (word.text.match(/\p{L}/gu) ?? []).length >= 4 && !repetitionStopWords.has(normalized) && !isName) {
          const last = previous.get(normalized);
          if (last && sentenceIndex-last.sentence <= 1 && wordIndex-last.word <= 40)
            finding('repetition',at,until,word.text,`„${word.text}“ wiederholt sich im selben oder benachbarten Satz (${wordIndex-last.word} Wörter Abstand). Prüfe, ob die Wiederholung beabsichtigt ist.`);
          previous.set(normalized,{sentence:sentenceIndex,word:wordIndex});
        }
        wordIndex++;
      }
      if (settings.wording) for (let i=0;i<words.length;i++) {
        if (i % 256 === 0) await checkpoint();
        const phrase = phraseTokens.find(p => p.every((word,j) => words[i+j] && normalize(words[i+j].text) === word && (!j || /^\s+$/u.test(text.slice(words[i+j-1].end,words[i+j].start)))));
        if (!phrase) continue;
        const begin = words[i].start, finish = words[i+phrase.length-1].end, value = text.slice(begin,finish);
        finding('wording',start+begin,start+finish,value,`„${value}“ kann die Aussage abschwächen oder verlängern. Prüfe im Kontext, ob die Formulierung etwas beiträgt; in Dialogen kann sie bewusst die Stimme einer Figur zeigen.`);
        i += phrase.length-1;
      }
    }
  }
  signal?.throwIfAborted();
  findings.sort((a,b) => a.from-b.from || a.to-b.to);
  findings.forEach((f,id) => f.id=id);
  return {findings,sentences};
}
