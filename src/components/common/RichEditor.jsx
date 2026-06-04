/**
 * RichEditor — WebView-based HTML rich text editor.
 *
 * Props:
 *   value        string   — initial HTML value (read once on mount)
 *   onChange     fn       — called with new HTML string on every change
 *   placeholder  string   — placeholder text
 *   minHeight    number   — min editor body height in px (default 120)
 *   style        object   — outer container style
 */
import React, {
  useRef,
  useState,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { COLORS } from '@constants/colors';
import { BORDER_RADIUS } from '@constants/config';

// ─── Build the static HTML page ONCE (on mount) ──────────────────────────────
function buildHtml({ initialHTML, placeholder, minHeight, bg, textColor, border, toolbarBg, mutedColor, primaryColor }) {
  const escaped = (initialHTML || '')
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`');

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:transparent;font-family:-apple-system,sans-serif}

  #toolbar{
    display:flex;flex-wrap:wrap;align-items:center;
    padding:4px 6px;
    background:${toolbarBg};
    border:1px solid ${border};
    border-bottom:none;
    border-radius:6px 6px 0 0;
  }
  #toolbar button{
    padding:5px 9px;margin:0 2px;border:none;background:transparent;
    font-size:13px;cursor:pointer;border-radius:4px;
    color:${mutedColor};transition:background .15s;
  }
  #toolbar button.active{background:${primaryColor}33;color:${primaryColor}}

  #editor{
    min-height:${minHeight}px;
    padding:10px 12px;
    background:${bg};
    border:1px solid ${border};
    border-radius:0 0 6px 6px;
    font-size:14px;line-height:1.6;
    color:${textColor};
    outline:none;
    word-break:break-word;
  }
  #editor:empty:before{
    content:attr(data-placeholder);
    color:#9ca3af;pointer-events:none;
  }
  ul,ol{padding-left:20px}
  b,strong{font-weight:700}
  i,em{font-style:italic}
  u{text-decoration:underline}
</style>
</head>
<body>
<div id="toolbar">
  <button data-cmd="bold"               onmousedown="e(event)" onclick="x('bold')"><b>B</b></button>
  <button data-cmd="italic"             onmousedown="e(event)" onclick="x('italic')"><i>I</i></button>
  <button data-cmd="underline"          onmousedown="e(event)" onclick="x('underline')"><u>U</u></button>
  <button data-cmd="insertUnorderedList" onmousedown="e(event)" onclick="x('insertUnorderedList')">• List</button>
  <button data-cmd="insertOrderedList"  onmousedown="e(event)" onclick="x('insertOrderedList')">1. List</button>
  <button data-cmd="undo"               onmousedown="e(event)" onclick="x('undo')">↩</button>
  <button data-cmd="redo"               onmousedown="e(event)" onclick="x('redo')">↪</button>
</div>
<div id="editor" contenteditable="true" data-placeholder="${placeholder}"></div>

<script>
  var ed = document.getElementById('editor');

  // Load initial HTML
  ed.innerHTML = \`${escaped}\`;

  function e(ev){ ev.preventDefault(); }

  function x(cmd){
    document.execCommand(cmd, false, null);
    ed.focus();
    notify();
    syncToolbar();
  }

  function notify(){
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ type:'change', html: ed.innerHTML })
    );
  }

  function notifyHeight(){
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ type:'height', value: document.body.scrollHeight })
    );
  }

  function syncToolbar(){
    document.querySelectorAll('[data-cmd]').forEach(function(btn){
      try{ btn.classList.toggle('active', document.queryCommandState(btn.dataset.cmd)); }catch(e){}
    });
  }

  ed.addEventListener('input',   function(){ notify(); notifyHeight(); });
  ed.addEventListener('keyup',   syncToolbar);
  ed.addEventListener('mouseup', syncToolbar);

  // Set content from RN (external update without reloading page)
  window.setContent = function(html){
    ed.innerHTML = html;
    notifyHeight();
  };

  setTimeout(notifyHeight, 150);
</script>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────
const RichEditor = forwardRef(function RichEditor(
  { value = '', onChange, placeholder = 'Enter description…', minHeight = 120, style },
  ref,
) {
  const webviewRef = useRef(null);
  const [height, setHeight] = useState(minHeight + 44);
  const prevValueRef = useRef(value); // track last value we pushed into the editor

  // Build HTML only ONCE on mount — using the initial value
  const sourceHtml = useMemo(
    () =>
      buildHtml({
        initialHTML:  value,
        placeholder,
        minHeight,
        bg:           COLORS.background   || '#ffffff',
        textColor:    COLORS.textPrimary  || '#111827',
        border:       COLORS.border       || '#e5e7eb',
        toolbarBg:    COLORS.surface      || '#f9fafb',
        mutedColor:   COLORS.textMuted    || '#6b7280',
        primaryColor: COLORS.primary      || '#6366f1',
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // intentionally empty — generate once
  );

  // If parent resets value externally (e.g. modal re-open), inject via JS
  const prevRenderedRef = useRef(value);
  if (value !== prevRenderedRef.current && value !== prevValueRef.current) {
    prevRenderedRef.current = value;
    webviewRef.current?.injectJavaScript(
      `window.setContent(${JSON.stringify(value)}); true;`
    );
  }

  useImperativeHandle(ref, () => ({
    focus: () => webviewRef.current?.injectJavaScript('ed.focus(); true;'),
    setContent: (html) => {
      prevValueRef.current = html;
      webviewRef.current?.injectJavaScript(
        `window.setContent(${JSON.stringify(html)}); true;`
      );
    },
  }));

  const onMessage = useCallback(
    (event) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'change') {
          prevValueRef.current = data.html;
          onChange?.(data.html);
        }
        if (data.type === 'height') {
          const next = Math.max(minHeight + 44, data.value + 4);
          setHeight(next);
        }
      } catch (_) {}
    },
    [onChange, minHeight],
  );

  return (
    <View style={[styles.container, { height }, style]}>
      <WebView
        ref={webviewRef}
        source={{ html: sourceHtml }}
        onMessage={onMessage}
        scrollEnabled={false}
        nestedScrollEnabled={false}
        showsVerticalScrollIndicator={false}
        originWhitelist={['*']}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
});

export default RichEditor;

const styles = StyleSheet.create({
  container: { borderRadius: BORDER_RADIUS.sm, overflow: 'hidden' },
  webview:   { flex: 1, backgroundColor: 'transparent' },
});
