/**
 * RichContent — renders HTML as native React Native components.
 * No WebView — zero scroll conflicts with the parent ScrollView.
 *
 * Handles: paragraphs, bold, italic, line-breaks, tables (h-scroll),
 *          unordered/ordered lists, blockquotes.
 *
 * Props:
 *   html       string  — raw HTML
 *   textStyle  object  — base style for text nodes
 *   style      object  — wrapper View style
 *   emptyText  string  — shown when empty (default '—')
 */
import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

import { COLORS }        from '@constants/colors';
import { BORDER_RADIUS } from '@constants/config';
import { stripHtml }     from '@utils/helpers';

const HAS_HTML = /<[a-z][\s\S]*>/i;

// ── Sanitiser: strip ALL attributes from every HTML tag ───────────────────

const EMPTY_TAG = /<[a-z][a-z0-9]*>(\s|&nbsp;)*<\/[a-z][a-z0-9]*>/gi;

function sanitize(html) {
  let h = (html ?? '').replace(/<([a-z][a-z0-9]*)\b[^>]*>/gi, '<$1>');
  let prev;
  do { prev = h; EMPTY_TAG.lastIndex = 0; h = h.replace(EMPTY_TAG, ''); }
  while (h !== prev);
  return h;
}

// ── Inline parser: text → [{text, bold, italic}] ─────────────────────────

function parseInline(html) {
  const segments = [];
  let bold = false;
  let italic = false;
  let pos = 0;

  const h = html
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n');

  while (pos < h.length) {
    if (h[pos] !== '<') {
      const next = h.indexOf('<', pos);
      const end  = next === -1 ? h.length : next;
      const raw  = h.slice(pos, end)
        .replace(/&#(\d+);/g,   (_, n) => String.fromCharCode(Number(n)))
        .replace(/&nbsp;/gi,   ' ')
        .replace(/&amp;/gi,    '&')
        .replace(/&lt;/gi,     '<')
        .replace(/&gt;/gi,     '>')
        .replace(/&quot;/gi,   '"')
        .replace(/&#39;/gi,    "'")
        .replace(/&ndash;/gi,  '–')
        .replace(/&mdash;/gi,  '—')
        .replace(/&lsquo;/gi,  String.fromCharCode(0x2018))
        .replace(/&rsquo;/gi,  String.fromCharCode(0x2019))
        .replace(/&ldquo;/gi,  String.fromCharCode(0x201C))
        .replace(/&rdquo;/gi,  String.fromCharCode(0x201D))
        .replace(/&hellip;/gi, '…')
        .replace(/&bull;/gi,   '•');
      if (raw) segments.push({ text: raw, bold, italic });
      pos = end;
      continue;
    }

    const close = h.indexOf('>', pos);
    if (close === -1) { pos++; continue; }

    const tagRaw = h.slice(pos + 1, close).trim().toLowerCase();
    const tag    = tagRaw.replace(/[\s/].*/, '');

    if      (tag === 'b'  || tag === 'strong')   bold   = true;
    else if (tag === '/b' || tag === '/strong')   bold   = false;
    else if (tag === 'i'  || tag === 'em')        italic = true;
    else if (tag === '/i' || tag === '/em')       italic = false;
    else if (tag === 'br')                        segments.push({ text: '\n', bold: false, italic: false });

    pos = close + 1;
  }

  return segments;
}

// ── Block splitter ────────────────────────────────────────────────────────

const BLOCK_RE =
  /(<table[\s\S]*?<\/table>|<blockquote[\s\S]*?<\/blockquote>|<ul[\s\S]*?<\/ul>|<ol[\s\S]*?<\/ol>)/gi;

function splitBlocks(html) {
  const blocks = [];
  let last = 0;
  let m;

  BLOCK_RE.lastIndex = 0;
  while ((m = BLOCK_RE.exec(html)) !== null) {
    const before = html.slice(last, m.index);
    if (before.trim()) blocks.push({ type: 'text', content: before });

    const open = m[1].slice(1, m[1].search(/[\s>]/)).toLowerCase();
    if (open === 'table')      blocks.push({ type: 'table',      content: m[1] });
    else if (open === 'ul')    blocks.push({ type: 'list',       content: m[1], ordered: false });
    else if (open === 'ol')    blocks.push({ type: 'list',       content: m[1], ordered: true  });
    else                       blocks.push({ type: 'blockquote', content: m[1] });

    last = m.index + m[1].length;
  }

  const tail = html.slice(last);
  if (tail.trim()) blocks.push({ type: 'text', content: tail });

  return blocks;
}

// ── Table parser ──────────────────────────────────────────────────────────

function parseTable(html) {
  const parseCells = (rowHtml, tag) => {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    const cells = [];
    let m;
    while ((m = re.exec(rowHtml)) !== null) cells.push(stripHtml(m[1]).trim());
    return cells;
  };

  const tbodyM  = html.match(/<tbody[\s\S]*?<\/tbody>/i);
  const src     = tbodyM ? tbodyM[0] : html;
  const rowRe   = /<tr[\s\S]*?<\/tr>/gi;
  const allRows = [];
  let rM;
  while ((rM = rowRe.exec(src)) !== null) allRows.push(rM[0]);

  let headers = [];
  let rows    = [];

  if (allRows.length === 0) return { headers, rows };

  const theadM = html.match(/<thead[\s\S]*?<\/thead>/i);
  if (theadM) {
    const trM = theadM[0].match(/<tr[\s\S]*?<\/tr>/i);
    if (trM) headers = parseCells(trM[0], 'th');
  }

  if (headers.length === 0) {
    const firstRow = allRows[0];
    const thCells  = parseCells(firstRow, 'th');
    headers = thCells.length > 0 ? thCells : parseCells(firstRow, 'td');
    allRows.shift();
  }

  rows = allRows
    .map(r => parseCells(r, 'td'))
    .filter(c => c.length > 0);

  return { headers, rows };
}

// ── Block renderers ───────────────────────────────────────────────────────

const TBL_FONT   = 10;
const TBL_MIN_W  = 20;
const TBL_CHAR_W = 6;
const TBL_H_PAD  = 16;

function contentMinWidths(headers, rows, colCount) {
  return Array.from({ length: colCount }, (_, i) => {
    const lens = [
      (headers[i] ?? '').length,
      ...rows.map(r => (r[i] ?? '').length),
    ];
    return Math.min(300, Math.max(TBL_MIN_W, Math.ceil(Math.max(...lens) * TBL_CHAR_W) + TBL_H_PAD));
  });
}

function resolveWidths(minWidths, containerW) {
  const total = minWidths.reduce((s, w) => s + w, 0);
  if (total >= containerW) return minWidths;
  const scale = containerW / total;
  return minWidths.map(w => Math.floor(w * scale));
}

function TableBlock({ content }) {
  const { headers, rows } = useMemo(() => parseTable(content), [content]);
  const colCount  = Math.max(headers.length, ...rows.map(r => r.length), 1);
  const minWidths = useMemo(() => contentMinWidths(headers, rows, colCount), [headers, rows, colCount]);
  const lastRow   = rows.length - 1;
  const lastCol   = colCount - 1;

  const [colWidths, setColWidths] = useState(minWidths);
  const onLayout = useCallback((e) => {
    setColWidths(resolveWidths(minWidths, e.nativeEvent.layout.width));
  }, [minWidths]);

  const cellWidth = (i) => ({ width: colWidths[i] });

  return (
    <View style={styles.tableWrap}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tableScrollContent}
      >
        <View style={styles.tableInner} onLayout={onLayout}>

          {headers.length > 0 && (
            <View style={styles.theadRow}>
              {Array.from({ length: colCount }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.cell,
                    styles.thCell,
                    cellWidth(i),
                    i === lastCol && styles.cellNoRight,
                  ]}
                >
                  <Text style={styles.thText}>{headers[i] ?? ''}</Text>
                </View>
              ))}
            </View>
          )}

          {rows.map((row, ri) => (
            <View key={ri} style={[styles.tdRow, ri % 2 === 1 && styles.altRow]}>
              {Array.from({ length: colCount }, (_, ci) => (
                <View
                  key={ci}
                  style={[
                    styles.cell,
                    cellWidth(ci),
                    ci === lastCol && styles.cellNoRight,
                    ri === lastRow && styles.cellNoBottom,
                  ]}
                >
                  <Text style={styles.tdText}>{row[ci] ?? ''}</Text>
                </View>
              ))}
            </View>
          ))}

        </View>
      </ScrollView>
    </View>
  );
}

function TextBlock({ content, baseStyle }) {
  const segments = useMemo(() => {
    const segs = parseInline(content);
    const out = [];
    let nlCount = 0;
    for (const s of segs) {
      if (s.text === '\n') {
        nlCount++;
        if (nlCount <= 2) out.push(s);
      } else {
        nlCount = 0;
        out.push(s);
      }
    }
    while (out.length && out[0].text.trim() === '')             out.shift();
    while (out.length && out[out.length - 1].text.trim() === '') out.pop();
    return out;
  }, [content]);

  if (!segments.length) return null;

  return (
    <Text style={[styles.text, baseStyle, styles.textBlock]}>
      {segments.map((s, i) => (
        <Text
          key={i}
          style={[s.bold && styles.bold, s.italic && styles.italic]}
        >
          {s.text}
        </Text>
      ))}
    </Text>
  );
}

function ListBlock({ content, ordered, baseStyle }) {
  const items = useMemo(() => {
    const re = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    const out = [];
    let m;
    while ((m = re.exec(content)) !== null) out.push(stripHtml(m[1]).trim());
    return out;
  }, [content]);

  return (
    <View style={styles.listWrap}>
      {items.map((item, i) => (
        <View key={i} style={styles.listRow}>
          <Text style={[styles.text, baseStyle, styles.listBullet]}>
            {ordered ? `${i + 1}.` : '•'}
          </Text>
          <Text style={[styles.text, baseStyle, styles.listItem]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function BlockquoteBlock({ content, baseStyle }) {
  const text = useMemo(
    () => stripHtml(content.replace(/<\/?blockquote[^>]*>/gi, '')).trim(),
    [content],
  );
  return (
    <View style={styles.bqWrap}>
      <Text style={[styles.text, styles.bqText, baseStyle]}>{text}</Text>
    </View>
  );
}

// ── Main export ───────────────────────────────────────────────────────────

export default function RichContent({
  html,
  textStyle,
  style,
  emptyText = '—',
}) {
  const hasHtml = useMemo(() => HAS_HTML.test(html ?? ''), [html]);

  const blocks = useMemo(() => {
    if (!hasHtml) return null;
    return splitBlocks(sanitize(html ?? ''));
  }, [html, hasHtml]);

  if (!hasHtml) {
    const plain = stripHtml(html).trim();
    return (
      <View style={style}>
        <Text style={textStyle}>{plain || emptyText}</Text>
      </View>
    );
  }

  if (!blocks?.length) {
    return (
      <View style={style}>
        <Text style={textStyle}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <View style={style}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'table':
            return <TableBlock key={i} content={block.content} />;
          case 'list':
            return (
              <ListBlock
                key={i}
                content={block.content}
                ordered={block.ordered}
                baseStyle={textStyle}
              />
            );
          case 'blockquote':
            return <BlockquoteBlock key={i} content={block.content} baseStyle={textStyle} />;
          default:
            return <TextBlock key={i} content={block.content} baseStyle={textStyle} />;
        }
      })}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  text: {
    color:      '#111827',
    fontSize:   14,
    lineHeight: 22,
  },
  textBlock: {
    marginBottom: 4,
  },
  bold:   { fontWeight: '700' },
  italic: { fontStyle: 'italic' },

  /* Table */
  tableWrap: {
    borderRadius:   8,
    overflow:       'hidden',
    borderWidth:    1,
    borderColor:    '#DDD6FE',
    marginVertical: 4,
  },
  tableScrollContent: {},
  tableInner:         {},
  theadRow: {
    flexDirection:   'row',
    backgroundColor: '#F3F4F6',
  },
  tdRow: {
    flexDirection:   'row',
    backgroundColor: '#ffffff',
  },
  altRow: { backgroundColor: '#F5F3FF' },
  cell: {
    paddingHorizontal: 12,
    paddingVertical:    7,
    borderRightWidth:   1,
    borderRightColor:   '#EDE9FE',
    borderBottomWidth:  1,
    borderBottomColor:  '#EDE9FE',
    justifyContent:     'flex-start',
  },
  cellNoRight:  { borderRightWidth:  0 },
  cellNoBottom: { borderBottomWidth: 0 },
  thCell: {
    borderRightColor:  '#E5E7EB',
    borderBottomWidth: 0,
  },
  thText: {
    color:      '#111827',
    fontWeight: '700',
    fontSize:   TBL_FONT,
  },
  tdText: {
    color:      '#1E1B4B',
    fontSize:   TBL_FONT,
    lineHeight: 15,
  },

  /* List */
  listWrap: { marginVertical: 4 },
  listRow:  { flexDirection: 'row', marginBottom: 3 },
  listBullet: { width: 20 },
  listItem:   { flex: 1, marginBottom: 0 },

  /* Blockquote */
  bqWrap: {
    borderLeftWidth:  3,
    borderLeftColor:  '#D1D5DB',
    paddingLeft:      10,
    marginVertical:    6,
  },
  bqText: { color: '#6B7280', fontStyle: 'italic' },
});
