/**
 * RichTextEditor — lightweight WebView-based rich text editor.
 *
 * Toolbar actions: Bold · Italic · Underline · Bullet list · Ordered list
 *
 * Ref methods:
 *   setContentHTML(html)     — programmatically set editor content
 *   focusContentEditor()     — focus the editor
 *   clearContentEditor()     — clear editor content
 *
 * Props:
 *   initialHTML   string    — pre-filled HTML on mount (read once, not reactive)
 *   onChange      fn(html)  — fired on every content change
 *   placeholder   string
 *   minHeight     number    — minimum editor body height in px (default 140)
 *   editorBg      string    — editor background colour (default #FFFFFF)
 */
import React, { useRef, useState, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import WebView from 'react-native-webview';

import { COLORS }        from '@constants/colors';
import { BORDER_RADIUS } from '@constants/config';

function buildHTML({ placeholder, initialHTML, minHeight, editorBg }) {
  const safeInitial     = JSON.stringify(initialHTML || '');
  const safePlaceholder = JSON.stringify(placeholder || 'Description');

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: ${editorBg || '#fff'}; }

  .toolbar {
    display: flex;
    align-items: center;
    padding: 4px 8px;
    gap: 4px;
    border-bottom: 1px solid #DDD6FE;
    background: #F5F3FF;
    flex-wrap: wrap;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .toolbar button {
    min-width: 34px;
    height: 32px;
    border: 1px solid #DDD6FE;
    border-radius: 6px;
    background: #ffffff;
    cursor: pointer;
    font-size: 13px;
    font-weight: 700;
    color: #6B7280;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 8px;
    user-select: none;
    -webkit-user-select: none;
    transition: background 0.1s;
  }
  .toolbar button:active,
  .toolbar button.active {
    background: #EDE9FE;
    border-color: #A78BFA;
    color: #7C3AED;
  }
  .toolbar button i { font-style: italic; }
  .toolbar button u { text-decoration: underline; }

  #editor {
    min-height: ${minHeight || 100}px;
    padding: 10px 12px 16px;
    outline: none;
    font-size: 15px;
    line-height: 1.6;
    color: #1E1B4B;
    word-break: break-word;
    background: ${editorBg || '#fff'};
  }
  #editor:empty:before {
    content: attr(data-placeholder);
    color: #9CA3AF;
    pointer-events: none;
  }
  ul { list-style-type: disc;    padding-left: 22px; margin: 4px 0; }
  ol { list-style-type: decimal; padding-left: 22px; margin: 4px 0; }
  li { margin: 2px 0; }
  b, strong { font-weight: 700; }
</style>
</head>
<body>
<div class="toolbar" id="toolbar">
  <button id="btn-bold"
    onmousedown="prevent(event)"
    ontouchend="execTouch(event,'bold')"
    onclick="exec('bold')"><b>B</b></button>
  <button id="btn-italic"
    onmousedown="prevent(event)"
    ontouchend="execTouch(event,'italic')"
    onclick="exec('italic')"><i>I</i></button>
  <button id="btn-underline"
    onmousedown="prevent(event)"
    ontouchend="execTouch(event,'underline')"
    onclick="exec('underline')"><u>U</u></button>
  <button id="btn-ul"
    onmousedown="prevent(event)"
    ontouchend="execTouch(event,'insertUnorderedList')"
    onclick="exec('insertUnorderedList')">• List</button>
  <button id="btn-ol"
    onmousedown="prevent(event)"
    ontouchend="execTouch(event,'insertOrderedList')"
    onclick="exec('insertOrderedList')">1. List</button>
</div>
<div id="editor" contenteditable="true" data-placeholder=""></div>

<script>
  var editor      = document.getElementById('editor');
  var lastContent = '';
  var savedRange  = null;
  var placeholder = ${safePlaceholder};
  editor.setAttribute('data-placeholder', placeholder);

  // ── Selection tracking ────────────────────────────────────────
  // Continuously track the editor's selection so we can restore it
  // after focus is temporarily lost when a toolbar button is tapped.
  document.addEventListener('selectionchange', function() {
    var sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }
  });

  function restoreSelection() {
    editor.focus();
    if (savedRange) {
      try {
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
      } catch (e) {}
    }
  }

  // ── Helpers ───────────────────────────────────────────────────
  function prevent(e) { e.preventDefault(); }

  // Desktop path: onmousedown=prevent keeps focus, onclick calls exec with live selection
  function exec(cmd) {
    restoreSelection();
    document.execCommand(cmd, false, null);
    savedRange = null;
    sendContent();
    updateToolbar();
  }

  // Mobile path: ontouchend fires → prevent synthetic click → exec
  // (ontouchstart must NOT call preventDefault — that blocks onclick on Android)
  function execTouch(e, cmd) {
    e.preventDefault(); // stop the subsequent synthetic click from double-firing
    exec(cmd);
  }

  function sendContent() {
    var html = editor.innerHTML;
    if (html === '<br>' || html === '<p><br></p>') html = '';
    if (html !== lastContent) {
      lastContent = html;
      send({ type: 'change', html: html });
    }
  }

  function sendHeight() {
    var h = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    send({ type: 'height', height: h });
  }

  function send(obj) {
    window.ReactNativeWebView.postMessage(JSON.stringify(obj));
  }

  function setContent(html) {
    editor.innerHTML = html || '';
    lastContent = editor.innerHTML; // track normalized version for change detection
    setTimeout(sendHeight, 50);
  }

  function updateToolbar() {
    var cmds = ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList'];
    var ids  = ['btn-bold', 'btn-italic', 'btn-underline', 'btn-ul', 'btn-ol'];
    cmds.forEach(function(cmd, i) {
      var btn = document.getElementById(ids[i]);
      if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
    });
  }

  editor.addEventListener('input',    function() { sendContent(); sendHeight(); });
  editor.addEventListener('keyup',    updateToolbar);
  editor.addEventListener('mouseup',  updateToolbar);
  editor.addEventListener('touchend', updateToolbar);
  editor.addEventListener('focus',    function() { send({ type: 'focus' }); });
  editor.addEventListener('blur',     sendContent);
  editor.addEventListener('paste',    function() {
    setTimeout(function() { sendContent(); sendHeight(); }, 0);
  });

  function handleMessage(e) {
    try {
      var msg = JSON.parse(e.data);
      if (msg.type === 'setContent') { setContent(msg.html); }
      if (msg.type === 'focus')      { editor.focus(); }
      if (msg.type === 'clear')      { setContent(''); }
    } catch(err) {}
  }
  document.addEventListener('message', handleMessage);
  window.addEventListener('message',   handleMessage);

  var initialContent = ${safeInitial};
  if (initialContent) { setContent(initialContent); }
  setTimeout(sendHeight, 100);
</script>
</body>
</html>`;
}

const RichTextEditor = forwardRef(function RichTextEditor(
  {
    initialHTML = '',
    onChange,
    placeholder = 'Description',
    minHeight   = 140,
    editorBg    = COLORS.surface,
    style,
  },
  ref,
) {
  const webViewRef  = useRef(null);
  // Keep onChange current without adding it to any dep array — prevents WebView reload
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [editorHeight, setEditorHeight] = useState(minHeight + 44); // +44 for toolbar

  // Build HTML exactly once on mount — intentionally ignores prop changes after mount.
  // Content updates after mount must use ref methods (setContentHTML, clearContentEditor).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => buildHTML({ placeholder, initialHTML, minHeight, editorBg }), []);

  useImperativeHandle(ref, () => ({
    setContentHTML: (html) => {
      webViewRef.current?.injectJavaScript(`setContent(${JSON.stringify(html)}); true;`);
    },
    focusContentEditor: () => {
      webViewRef.current?.injectJavaScript(`editor.focus(); true;`);
    },
    clearContentEditor: () => {
      webViewRef.current?.injectJavaScript(`setContent(''); true;`);
    },
  }));

  const handleMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'change') {
        onChangeRef.current?.(msg.html);
      }
      if (msg.type === 'height') {
        const h = Math.max(minHeight + 44, msg.height + 4);
        setEditorHeight(h);
      }
    } catch (_) {}
  }, [minHeight]);

  return (
    <View style={[styles.container, { height: editorHeight }, style]}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        onMessage={handleMessage}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        keyboardDisplayRequiresUserAction={false}
        style={styles.webview}
        originWhitelist={['*']}
        nestedScrollEnabled={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderWidth:  1,
    borderColor:  COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    overflow:     'hidden',
  },
  webview: {
    flex:            1,
    backgroundColor: 'transparent',
  },
});

export default RichTextEditor;
