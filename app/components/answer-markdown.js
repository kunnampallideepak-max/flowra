// Bounded Markdown subset: React escapes text; never inject model HTML.
function inline(text, depth = 0) {
  if (depth > 3) return text.replace(/\*\*/g, '');
  const tokens = /(`[^`\n]+`|\*\*([\s\S]+?)\*\*(?!\*)|__([\s\S]+?)__|\*([^*\n]+)\*)/g;
  const result = []; let cursor = 0;
  for (const match of text.matchAll(tokens)) {
    if (match.index > cursor) result.push(text.slice(cursor, match.index).replace(/\*\*/g, ''));
    const part = match[0], key = `${depth}-${match.index}`;
    result.push(part.startsWith('`') ? <code key={key}>{part.slice(1, -1)}</code> : match[2] || match[3] ? <strong key={key}>{inline(match[2] || match[3], depth + 1)}</strong> : <em key={key}>{match[4]}</em>);
    cursor = match.index + part.length;
  }
  result.push(text.slice(cursor).replace(/\*\*/g, ''));
  return result;
}
export default function AnswerMarkdown({ text = '' }) {
  const blocks = []; let list = [], ordered = false, paragraph = [], code = null;
  const flushParagraph = () => { if (paragraph.length) { blocks.push(<p key={blocks.length}>{inline(paragraph.join(' '))}</p>); paragraph = []; } };
  const flushList = () => { if (list.length) { const Tag = ordered ? 'ol' : 'ul'; blocks.push(<Tag key={blocks.length}>{list.map((line, index) => <li key={index}>{inline(line)}</li>)}</Tag>); list = []; } };
  const flushCode = () => { if (code !== null) { blocks.push(<pre key={blocks.length}><code>{code.join('\n')}</code></pre>); code = null; } };
  for (const line of String(text).split(/\r?\n/)) {
    if (/^\s*```/.test(line)) { flushParagraph(); flushList(); if (code === null) code = []; else flushCode(); continue; }
    if (code !== null) { code.push(line); continue; }
    const match = line.match(/^\s*(?:([-*+])|\d+[.)])\s+(.+)$/);
    if (match) { flushParagraph(); const nextOrdered = !match[1]; if (list.length && ordered !== nextOrdered) flushList(); ordered = nextOrdered; list.push(match[2]); continue; }
    flushList();
    if (!line.trim()) { flushParagraph(); continue; }
    if (/^\s*#{1,6}\s+/.test(line)) { flushParagraph(); blocks.push(<h4 key={blocks.length}>{inline(line.replace(/^\s*#{1,6}\s+/, '').replace(/\s+#+$/, ''))}</h4>); }
    else if (/^\s*>\s?/.test(line)) { flushParagraph(); blocks.push(<blockquote key={blocks.length}>{inline(line.replace(/^\s*>\s?/, ''))}</blockquote>); }
    else if (/^\s*([-*_])\1{2,}\s*$/.test(line)) flushParagraph();
    else paragraph.push(line.trim());
  }
  flushParagraph(); flushList(); flushCode();
  return <div className="answer-markdown">{blocks}</div>;
}
