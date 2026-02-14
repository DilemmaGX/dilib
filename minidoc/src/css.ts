/**
 * Default CSS styles for Minidoc.
 * Includes Maple Mono NF CN font, table-based code layout, sticky line numbers,
 * collapsible blocks, and GFM alerts styling.
 */
export const defaultCss = `
/* Maple Mono NF CN Font */
@font-face {
  font-family: 'Maple Mono NF CN';
  src: url('https://cdn.jsdelivr.net/gh/subframe7536/maple-font@v7.0/WOFF2/MapleMono-NF-CN-Regular.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

/* Fallback: Maple Mono (Standard) */
@font-face {
  font-family: 'Maple Mono';
  src: url('https://cdn.jsdelivr.net/fontsource/fonts/maple-mono@latest/latin-400-normal.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.6;
  padding: 2rem;
  max-width: 900px;
  margin: 0 auto;
  color: #24292f;
}

/* Code Blocks (Table Layout) */
.minidoc-code-wrapper {
  width: 100%;
  margin: 1rem 0;
  border-radius: 6px;
  border: 1px solid #d0d7de;
  overflow: hidden;
  position: relative;
}

.minidoc-code-wrapper-with-copy {
  padding-top: 32px;
}

.minidoc-copy-button {
  position: absolute;
  top: 6px;
  right: 6px;
  border: 1px solid #d0d7de;
  background: #ffffff;
  color: #24292f;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 6px;
  cursor: pointer;
}

.minidoc-copy-button.minidoc-copied {
  background: #dafbe1;
  border-color: #2da44e;
  color: #1a7f37;
}

.minidoc-word-wrap .minidoc-table {
  table-layout: fixed;
}

.minidoc-word-wrap .minidoc-line-code pre {
  white-space: pre-wrap;
  word-wrap: break-word;
}

.minidoc-no-wrap {
  overflow-x: auto;
}

.minidoc-no-wrap .minidoc-table {
  table-layout: auto;
  width: auto;
  min-width: 100%;
}

.minidoc-table {
  width: 100%;
  border-collapse: separate; /* Required for sticky to work on some browsers */
  border-spacing: 0;
  background: #f6f8fa;
  font-family: 'Maple Mono NF CN', 'Maple Mono', monospace;
  font-size: 14px;
  border: none;
  margin: 0; /* Wrapper handles margin/border */
  font-feature-settings: "cv01", "cv02", "ss01", "ss02", "ss03", "ss04";
}

.minidoc-table td {
  padding: 0;
  vertical-align: top;
  line-height: 1.5;
}

.minidoc-line-num {
  width: 3rem;
  min-width: 3rem;
  text-align: right;
  padding: 0 10px 0 10px;
  color: #8c959f;
  user-select: none;
  background: #ffffff;
  border-right: 1px solid #d0d7de;
  font-size: 12px;
  vertical-align: top;
  position: sticky;
  left: 0;
  z-index: 1;
}

.minidoc-line-code {
  padding: 0 0 0 10px;
  width: 100%;
  vertical-align: top;
}

.minidoc-line-code pre {
  margin: 0;
  padding: 0;
  background: transparent;
  border: none;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}

.minidoc-line-code code {
  font-family: inherit;
  font-size: inherit;
  padding: 0;
  margin: 0;
  background: transparent;
  color: inherit;
}

/* Collapsible & Title */
.minidoc-details {
  border: 1px solid #d0d7de;
  border-radius: 6px;
  margin: 1rem 0;
  overflow: hidden;
}

.minidoc-details .minidoc-code-wrapper {
  margin: 0;
  border: none;
  border-radius: 0;
}

.minidoc-summary {
  padding: 8px 12px;
  background: #f6f8fa;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  list-style: none;
  font-size: 12px;
  font-weight: 600;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #24292f;
  border-bottom: 1px solid #d0d7de;
}

.minidoc-summary::-webkit-details-marker {
  display: none;
}

.minidoc-summary-icon svg {
  transition: transform 0.2s;
}

details[open] .minidoc-summary-icon svg {
  transform: rotate(180deg);
}

.minidoc-block-container {
  border: 1px solid #d0d7de;
  border-radius: 6px;
  margin: 1rem 0;
  overflow: hidden;
}

.minidoc-block-container .minidoc-code-wrapper {
  margin: 0;
  border: none;
  border-radius: 0;
}

.minidoc-title {
  padding: 8px 12px;
  background: #f6f8fa;
  font-size: 12px;
  font-weight: 600;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #24292f;
  border-bottom: 1px solid #d0d7de;
}

.minidoc-mermaid {
  border: 1px solid #d0d7de;
  border-radius: 6px;
  margin: 1rem 0;
  overflow: hidden;
}

.minidoc-mermaid-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f6f8fa;
  border-bottom: 1px solid #d0d7de;
}

.minidoc-mermaid-toggle {
  display: flex;
  gap: 6px;
}

.minidoc-mermaid-button {
  font-size: 12px;
  padding: 2px 8px;
  border: 1px solid #d0d7de;
  background: #ffffff;
  border-radius: 6px;
  cursor: pointer;
  color: #24292f;
}

.minidoc-mermaid-button.minidoc-active {
  background: #0969da;
  border-color: #0969da;
  color: #ffffff;
}

.minidoc-mermaid-diagram {
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  padding: 12px;
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
  width: 100%;
  aspect-ratio: 16 / 10;
}

.minidoc-mermaid-diagram .mermaid {
  font-family: 'trebuchet ms', verdana, arial, sans-serif;
}

.minidoc-mermaid-diagram.minidoc-panning {
  cursor: grabbing;
}

.minidoc-mermaid-diagram svg {
  max-width: 100%;
  height: auto;
  user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
}

.minidoc-mermaid-pan {
  display: inline-block;
  transform: translate(0px, 0px);
  transform-origin: center center;
}

.minidoc-mermaid-source {
  padding: 0;
}

.minidoc-mermaid-source .minidoc-code-wrapper {
  margin: 0;
  border: none;
  border-radius: 0;
}

/* Inline Code */
code:not(.hljs) {
  font-family: 'Maple Mono NF CN', 'Maple Mono', monospace;
  background-color: rgba(175, 184, 193, 0.2);
  padding: 0.2em 0.4em;
  border-radius: 6px;
  font-size: 85%;
  font-feature-settings: "cv01", "cv02", "ss01", "ss02", "ss03", "ss04";
  color: #24292f;
}

pre {
  margin: 0;
  font-family: inherit;
}

/* GFM Alerts & Quotes */
.markdown-alert {
  padding: 0.5rem 1rem;
  margin: 1rem 0;
  border-radius: 6px;
  border: 1px solid #d0d7de;
  background: #fff;
}

.markdown-alert-title {
  display: flex;
  align-items: center;
  font-weight: bold;
  margin-bottom: 0.5rem;
  font-size: 14px;
}

.markdown-alert-title svg {
  margin-right: 8px;
  fill: currentColor;
}

/* Alert Colors */
.markdown-alert-note {
  background-color: #ddf4ff;
  border-color: #0969da;
}
.markdown-alert-note .markdown-alert-title { color: #0969da; }

.markdown-alert-tip {
  background-color: #ddffdd;
  border-color: #1a7f37;
}
.markdown-alert-tip .markdown-alert-title { color: #1a7f37; }

.markdown-alert-important {
  background-color: #ddddff;
  border-color: #8250df;
}
.markdown-alert-important .markdown-alert-title { color: #8250df; }

.markdown-alert-warning {
  background-color: #fff8c5;
  border-color: #9a6700;
}
.markdown-alert-warning .markdown-alert-title { color: #9a6700; }

.markdown-alert-caution {
  background-color: #ffebe9;
  border-color: #cf222e;
}
.markdown-alert-caution .markdown-alert-title { color: #cf222e; }

.markdown-alert-quote {
  background-color: #f6f8fa;
  border-color: #d0d7de;
}
.markdown-alert-quote .markdown-alert-title { color: #6e7781; }

/* Highlight.js GitHub Theme */
pre code.hljs{display:block;overflow-x:auto;padding:0}code.hljs{padding:0}
.hljs{color:#24292e;background:#ffffff}
.hljs-doctag,.hljs-keyword,.hljs-meta .hljs-keyword,.hljs-template-tag,.hljs-template-variable,.hljs-type,.hljs-variable.language_{color:#d73a49}
.hljs-title,.hljs-title.class_,.hljs-title.class_.inherited__,.hljs-title.function_{color:#6f42c1}
.hljs-attr,.hljs-attribute,.hljs-literal,.hljs-meta,.hljs-number,.hljs-operator,.hljs-variable,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id{color:#005cc5}
.hljs-regexp,.hljs-string,.hljs-meta .hljs-string{color:#032f62}
.hljs-built_in,.hljs-symbol{color:#e36209}
.hljs-comment,.hljs-code,.hljs-formula{color:#6a737d}
.hljs-name,.hljs-quote,.hljs-selector-tag,.hljs-selector-pseudo{color:#22863a}
.hljs-subst{color:#24292e}
.hljs-section{color:#005cc5;font-weight:bold}
.hljs-bullet{color:#735c0f}
.hljs-emphasis{color:#24292e;font-style:italic}
.hljs-strong{color:#24292e;font-weight:bold}
.hljs-addition{color:#22863a;background-color:#f0fff4}
.hljs-deletion{color:#b31d28;background-color:#ffeef0}
`;
