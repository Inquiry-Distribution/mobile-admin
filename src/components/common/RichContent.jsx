/**
 * RichContent — display HTML content, with table-aware rendering.
 *
 * - If the HTML contains a <table>, renders it in a read-only WebView
 *   with proper table styling (scrollable horizontally if wide).
 * - Otherwise renders stripped plain text in a <Text> node.
 *
 * Props:
 *   html        string   — raw HTML string
 *   textStyle   object   — style forwarded to the plain-text <Text>
 *   style       object   — wrapper View style (applies to both modes)
 *   emptyText   string   — shown when content is empty (default '—')
 */
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import WebView from 'react-native-webview';

import { COLORS }        from '@constants/colors';
import { BORDER_RADIUS } from '@constants/config';
import { stripHtml }     from '@utils/helpers';

const HAS_TABLE = /<table[\s>]/i;

function buildTableHTML(html) {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    color: #1E1B4B;
    background: #ffffff;
    padding: 0;
    overflow-x: auto;
  }
  p  { margin: 0 0 8px; }
  ul { list-style: disc;    padding-left: 18px; margin: 4px 0; }
  ol { list-style: decimal; padding-left: 18px; margin: 4px 0; }
  li { margin: 2px 0; }
  b, strong { font-weight: 700; }
  i, em     { font-style: italic; }

  /* ── Table ── */
  .table-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    border-radius: 8px;
    border: 1px solid #DDD6FE;
    margin: 4px 0;
  }
  table {
    border-collapse: collapse;
    min-width: 100%;
    font-size: 13px;
  }
  th {
    background: #7C3AED;
    color: #ffffff;
    font-weight: 700;
    padding: 8px 12px;
    text-align: left;
    white-space: nowrap;
    border-right: 1px solid rgba(255,255,255,0.2);
  }
  th:last-child { border-right: none; }
  td {
    padding: 7px 12px;
    border-bottom: 1px solid #EDE9FE;
    border-right: 1px solid #EDE9FE;
    vertical-align: top;
  }
  td:last-child { border-right: none; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: #F5F3FF; }
  tr:hover td { background: #EDE9FE; }
</style>
</head>
<body>
<script>
  // Wrap every table in a scrollable div so wide tables scroll horizontally.
  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('table').forEach(function(t) {
      var wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      t.parentNode.insertBefore(wrap, t);
      wrap.appendChild(t);
    });
    sendHeight();
  });

  function sendHeight() {
    var h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', h: h }));
  }

  // Re-measure after images / late renders.
  window.addEventListener('load', function() { setTimeout(sendHeight, 80); });
</script>
${html}
</body>
</html>`;
}

export default function RichContent({
  html,
  textStyle,
  style,
  emptyText = '—',
}) {
  const hasTable = useMemo(() => HAS_TABLE.test(html ?? ''), [html]);
  const [webHeight, setWebHeight] = useState(80);
  const [ready,     setReady]     = useState(false);

  const handleMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'height' && msg.h > 0) {
        setWebHeight(msg.h + 8);
        setReady(true);
      }
    } catch (_) {}
  }, []);

  if (!hasTable) {
    const plain = stripHtml(html).trim();
    return (
      <View style={style}>
        <Text style={textStyle}>{plain || emptyText}</Text>
      </View>
    );
  }

  const source = useMemo(() => ({ html: buildTableHTML(html ?? '') }), [html]);

  return (
    <View style={[styles.webWrap, { height: webHeight }, style]}>
      {!ready && (
        <ActivityIndicator
          size="small"
          color={COLORS.primary}
          style={StyleSheet.absoluteFill}
        />
      )}
      <WebView
        source={source}
        onMessage={handleMessage}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        originWhitelist={['*']}
        style={[styles.webview, !ready && styles.hidden]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  webWrap: {
    borderRadius: BORDER_RADIUS.sm,
    overflow:     'hidden',
  },
  webview: {
    flex:            1,
    backgroundColor: 'transparent',
  },
  hidden: {
    opacity: 0,
  },
});
