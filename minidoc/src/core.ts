import fs from 'fs';
import path from 'path';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import * as octicons from '@primer/octicons';
import { defaultCss } from './css';

/**
 * Core functionality for Minidoc.
 * This module contains the main logic for processing documentation files.
 * @module core
 */

/**
 * Options for the Minidoc processor.
 */
export interface MinidocOptions {
  /**
   * The title of the documentation.
   * @default "Minidoc"
   */
  title?: string;

  /**
   * Whether to enable verbose logging.
   * @default false
   */
  verbose?: boolean;

  /**
   * Current working directory for resolving relative paths.
   * @default process.cwd()
   */
  cwd?: string;

  /**
   * Whether to enable word wrap for code blocks.
   * If false, code blocks will scroll horizontally.
   * @default true
   */
  wordWrap?: boolean;

  showCopyButton?: boolean;
}

/**
 * Result of the processing operation.
 */
export interface ProcessResult {
  /**
   * The original content.
   */
  original: string;

  /**
   * The processed content (HTML).
   */
  output: string;

  /**
   * Metadata extracted from the content.
   */
  metadata: Record<string, unknown>;
}

/**
 * SVG icons used for GFM alerts.
 */
const ICONS: Record<string, string> = {
  note: octicons.info.toSVG({ class: 'octicon' }),
  tip: octicons['light-bulb'].toSVG({ class: 'octicon' }),
  important:
    '<svg viewBox="0 0 16 16" width="16" height="16" class="octicon"><path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path><path d="M8 4a.75.75 0 0 1 .75.75v2.5a.75.75 0 0 1-1.5 0v-2.5A.75.75 0 0 1 8 4Zm0 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>',
  warning:
    '<svg viewBox="0 0 16 16" width="16" height="16" class="octicon"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path></svg>',
  caution:
    '<svg viewBox="0 0 16 16" width="16" height="16" class="octicon"><path d="M4.47.22A.75.75 0 0 1 5 0h6a.75.75 0 0 1 .53.22l4.25 4.25c.141.14.22.331.22.53v6a.75.75 0 0 1-.22.53l-4.25 4.25A.75.75 0 0 1 11 16H5a.75.75 0 0 1-.53-.22L.22 11.53A.75.75 0 0 1 0 11V5a.75.75 0 0 1 .22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>',
  quote: octicons.quote.toSVG({ class: 'octicon' }),
};

/**
 * Interface defining options for code table generation.
 */
interface CodeTableOptions {
  /** Whether the code block should be collapsible. */
  isCollapsible?: boolean;
  /** Whether the collapsible block is collapsed by default. */
  defaultCollapsed?: boolean;
  /** Whether to display a title for the code block. */
  enableTitle?: boolean;
  /** Custom title text. */
  customTitle?: string;
  /** Path to the source file (used for default title). */
  filePath?: string;
  /** Starting line number of the source file. */
  startLine?: number;
  /** Ending line number of the source file. */
  endLine?: number;
  /** Whether to enable word wrapping. */
  wordWrap?: boolean;

  showCopyButton?: boolean;
}

/**
 * Splits HTML content by newlines while preserving tag nesting.
 * This ensures that multi-line spans (like those from syntax highlighters) are correctly closed and reopened on each line.
 *
 * @param html - The HTML string to split.
 * @returns An array of HTML strings, one for each line.
 */
function splitHtmlByLines(html: string): string[] {
  const lines: string[] = [];
  let currentLine = '';
  const stack: string[] = [];
  const regex = /(<[^>]+>)|([^<]+)/g;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const tag = match[1];
    const text = match[2];
    if (tag) {
      if (tag.startsWith('</')) {
        stack.pop();
      } else if (!tag.endsWith('/>') && !tag.startsWith('<!')) {
        stack.push(tag);
      }
      currentLine += tag;
    } else if (text) {
      const parts = text.split('\n');
      parts.forEach((part, i) => {
        if (i > 0) {
          for (let j = stack.length - 1; j >= 0; j--) {
            const tagName = stack[j].match(/<(\w+)/)?.[1];
            if (tagName) currentLine += `</${tagName}>`;
          }
          lines.push(currentLine);
          currentLine = '';
          stack.forEach((t) => (currentLine += t));
        }
        currentLine += part;
      });
    }
  }
  lines.push(currentLine);
  return lines;
}



/**
 * Builds the HTML for a copy button.
 *
 * @param code - The code content to be copied.
 * @param enabled - Whether the copy button is enabled.
 * @returns The HTML string for the copy button, or an empty string if disabled.
 */
function buildCopyButton(code: string, enabled?: boolean): string {
  if (!enabled) {
    return '';
  }
  const encoded = encodeURIComponent(code);
  return `<button class="minidoc-copy-button" type="button" data-code="${encoded}">Copy</button>`;
}

/**
 * Generates the HTML table structure for code blocks with line numbers.
 *
 * @param code - The raw code content.
 * @param displayStart - The starting line number to display.
 * @param lang - The programming language for syntax highlighting.
 * @param options - Configuration options for the code table.
 * @returns The complete HTML string for the code block.
 */
function generateCodeTable(
  code: string,
  displayStart: number = 1,
  lang: string = '',
  options: CodeTableOptions = {}
): string {
  const codeTrimmed = code.replace(/\n$/, '');

  let highlightedCode = '';
  if (lang && hljs.getLanguage(lang)) {
    try {
      highlightedCode = hljs.highlight(codeTrimmed, { language: lang }).value;
    } catch (e) {
      highlightedCode = escapeHtml(codeTrimmed);
    }
  } else {
    highlightedCode = escapeHtml(codeTrimmed);
  }

  const htmlLines = splitHtmlByLines(highlightedCode);

  let titleText = '';
  if (options.enableTitle) {
    titleText = options.customTitle || '';
    if (!titleText && options.filePath) {
      titleText = `${options.filePath}:${options.startLine}-${options.endLine}`;
    }
  }

  const wordWrapClass = options.wordWrap === false ? 'minidoc-no-wrap' : 'minidoc-word-wrap';
  const langClass = lang ? 'language-' + lang : '';
  const copyButton = buildCopyButton(codeTrimmed, options.showCopyButton);
  const wrapperClass = options.showCopyButton
    ? `${wordWrapClass} minidoc-code-wrapper-with-copy`
    : wordWrapClass;

  const rows = htmlLines
    .map((lineContent, i) => {
      const lineNum = displayStart + i;
      const content = lineContent.length > 0 ? lineContent : ' ';
      return `<tr><td class="minidoc-line-num">${lineNum}</td><td class="minidoc-line-code"><pre><code class="hljs ${langClass}">${content}</code></pre></td></tr>`;
    })
    .join('');

  const tableHtml = `<div class="minidoc-code-wrapper ${wrapperClass}">${copyButton}<table class="minidoc-table"><tbody>${rows}</tbody></table></div>`;

  let html = '';
  if (options.isCollapsible) {
    const openAttr = options.defaultCollapsed ? '' : 'open';
    const summaryContent = titleText || 'Code';
    html = `<details class="minidoc-details" ${openAttr}><summary class="minidoc-summary"><span>${summaryContent}</span><span class="minidoc-summary-icon"><svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-chevron-down"><path d="M12.78 6.22a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L3.22 7.28a.75.75 0 0 1 1.06-1.06L8 9.94l3.72-3.72a.75.75 0 0 1 1.06 0Z"></path></svg></span></summary>${tableHtml}</details>`;
  } else {
    if (titleText) {
      html = `<div class="minidoc-block-container"><div class="minidoc-title">${titleText}</div>${tableHtml}</div>`;
    } else {
      html = tableHtml;
    }
  }

  return html;
}

/**
 * Generates the HTML structure for a Mermaid diagram block.
 * Includes a toolbar with view switching (Diagram/Source) and copy functionality.
 *
 * @param code - The Mermaid code.
 * @param options - Configuration options.
 * @returns The complete HTML string for the Mermaid block.
 */
function generateMermaidBlock(
  code: string,
  options: { wordWrap: boolean; showCopyButton: boolean }
): string {
  const codeTrimmed = code.replace(/\n$/, '');
  const encoded = encodeURIComponent(codeTrimmed);
  const copyButton = buildCopyButton(codeTrimmed, options.showCopyButton);
  const sourceHtml = generateCodeTable(codeTrimmed, 1, 'mermaid', {
    wordWrap: options.wordWrap,
    showCopyButton: false,
  });
  const toolbar = `<div class="minidoc-mermaid-toolbar"><div class="minidoc-mermaid-toggle"><button type="button" class="minidoc-mermaid-button minidoc-active" data-view="diagram">Diagram</button><button type="button" class="minidoc-mermaid-button" data-view="source">Source</button></div>${copyButton}</div>`;
  const diagramHtml = `<div class="minidoc-mermaid-diagram"><div class="minidoc-mermaid-pan"><pre class="mermaid">${escapeHtml(
    codeTrimmed
  )}</pre></div></div>`;
  return `<div class="minidoc-mermaid" data-code="${encoded}">${toolbar}${diagramHtml}<div class="minidoc-mermaid-source" hidden>${sourceHtml}</div></div>`;
}

/**
 * Processes the input markdown content and produces a result.
 *
 * @param {string} content - The markdown content to process.
 * @param {MinidocOptions} [options={}] - Configuration options.
 * @returns {ProcessResult} The result of the processing.
 */
export async function processContent(
  content: string,
  options: MinidocOptions = {}
): Promise<ProcessResult> {
  const title = options.title || 'Minidoc';
  const cwd = options.cwd || process.cwd();
  const wordWrap = options.wordWrap !== undefined ? options.wordWrap : true;
  const showCopyButton = options.showCopyButton !== undefined ? options.showCopyButton : true;

  if (options.verbose) {
    console.log(`Processing content with title: ${title}`);
  }

  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
  });

  md.renderer.rules.fence = (tokens, idx, mdOptions, env, self) => {
    void mdOptions;
    void env;
    void self;
    const token = tokens[idx];
    const content = token.content;
    const info = token.info ? md.utils.unescapeAll(token.info).trim() : '';
    const langName = info.split(/\s+/)[0];
    if (langName.toLowerCase() === 'mermaid') {
      return generateCodeTable(content, 1, langName, { wordWrap, showCopyButton });
    }
    return generateCodeTable(content, 1, langName, { wordWrap, showCopyButton });
  };

  md.core.ruler.push('gfm_alerts', (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type === 'blockquote_open') {
        const openToken = tokens[i];
        let isAlert = false;
        let alertType = '';
        let alertTitle = '';

        let j = i + 1;
        while (j < tokens.length && tokens[j].type !== 'blockquote_close') {
          if (tokens[j].type === 'inline') {
            const inlineToken = tokens[j];
            const content = inlineToken.content;
            const match = content.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/);

            if (match) {
              isAlert = true;
              alertType = match[1].toLowerCase();
              alertTitle = match[1];

              if (inlineToken.children && inlineToken.children.length > 0) {
                const firstChild = inlineToken.children[0];
                if (firstChild.type === 'text') {
                  firstChild.content = firstChild.content.replace(
                    /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s?/,
                    ''
                  );
                }
              }
              break;
            }
          }
          j++;
        }

        if (isAlert) {
          openToken.attrJoin('class', `markdown-alert markdown-alert-${alertType}`);

          const icon = ICONS[alertType] || '';
          const titleToken = new state.Token('html_block', '', 0);
          titleToken.content = `<p class="markdown-alert-title">${icon}${alertTitle}</p>`;
          tokens.splice(i + 1, 0, titleToken);
        } else {
          openToken.attrJoin('class', `markdown-alert markdown-alert-quote`);

          const icon = ICONS.quote || '';
          const titleToken = new state.Token('html_block', '', 0);
          titleToken.content = `<p class="markdown-alert-title">${icon}QUOTE</p>`;
          tokens.splice(i + 1, 0, titleToken);
        }
      }
    }
  });

  const quoteRegex =
    /{{\s*"([^"]+)"\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d+))?(?:\s*,\s*(true|false))?(?:\s*,\s*(true|false))?(?:\s*,\s*(true|false))?(?:\s*,\s*"([^"]*)")?(?:\s*,\s*(true|false))?\s*}}/g;

  const mermaidBlocks: { placeholder: string; code: string }[] = [];
  const mermaidRegex = /```mermaid\s*([\s\S]*?)```/g;
  const contentWithMermaidPlaceholders = content.replace(mermaidRegex, (match, code) => {
    const placeholder = `<!--MINIDOC_MERMAID_${mermaidBlocks.length}-->`;
    mermaidBlocks.push({ placeholder, code });
    return placeholder;
  });

  const preProcessedContent = contentWithMermaidPlaceholders.replace(
    quoteRegex,
    (
      match,
      filePath,
      startStr,
      endStr,
      displayStartStr,
      collapsibleStr,
      defaultCollapsedStr,
      enableTitleStr,
      customTitleStr,
      wordWrapStr
    ) => {
      try {
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        const displayStart = displayStartStr ? parseInt(displayStartStr, 10) : start;

        const isCollapsible = collapsibleStr === 'true';
        const defaultCollapsed = defaultCollapsedStr === 'true';
        const enableTitle = enableTitleStr === 'true';
        const customTitle = customTitleStr || undefined;
        const localWordWrap = wordWrapStr ? wordWrapStr === 'true' : wordWrap;

        const absPath = path.resolve(cwd, filePath);

        if (!fs.existsSync(absPath)) {
          return `<!-- Error: File not found ${filePath} -->`;
        }

        const fileContent = fs.readFileSync(absPath, 'utf-8');
        const lines = fileContent.split(/\r?\n/);

        if (start < 1 || end > lines.length || start > end) {
          return `<!-- Error: Invalid line range ${start}-${end} -->`;
        }

        const selectedLines = lines.slice(start - 1, end);
        const code = selectedLines.join('\n');

        const ext = path.extname(filePath).substring(1);

        return generateCodeTable(code, displayCodeStart(displayStart), ext, {
          isCollapsible,
          defaultCollapsed,
          enableTitle,
          customTitle,
          filePath,
          startLine: start,
          endLine: end,
          wordWrap: localWordWrap,
          showCopyButton,
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return `<!-- Error processing quote: ${message} -->`;
      }
    }
  );

  /**
   * Helper to ensure the display start line is a valid number.
   * @param num - The number to check.
   * @returns The number or 1 if invalid.
   */
  function displayCodeStart(num: number) {
    return isNaN(num) ? 1 : num;
  }

  let htmlOutput = md.render(preProcessedContent);
  for (const block of mermaidBlocks) {
    const blockHtml = generateMermaidBlock(block.code, { wordWrap, showCopyButton });
    htmlOutput = htmlOutput.replace(block.placeholder, blockHtml);
  }

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
${defaultCss}
</style>
</head>
<body>
${htmlOutput}
<script type="module">
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
const copyButtons = document.querySelectorAll('.minidoc-copy-button');
const whenLoaded = async () => {
  await new Promise((resolve) => {
    if (document.readyState === 'complete') {
      resolve(null);
    } else {
      window.addEventListener('load', () => resolve(null), { once: true });
    }
  });
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
};
const copyWithFallback = async (text) => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'readonly');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};
for (const button of copyButtons) {
  button.addEventListener('click', async () => {
    const encoded = button.getAttribute('data-code') || '';
    const text = decodeURIComponent(encoded);
    const previous = button.textContent || 'Copy';
    try {
      await copyWithFallback(text);
      button.classList.add('minidoc-copied');
      button.textContent = 'Copied';
      setTimeout(() => {
        button.textContent = previous;
        button.classList.remove('minidoc-copied');
      }, 1200);
    } catch (e) {
      button.textContent = previous;
    }
  });
}
const mermaidBlocks = document.querySelectorAll('.minidoc-mermaid');
for (const block of mermaidBlocks) {
  const diagramView = block.querySelector('.minidoc-mermaid-diagram');
  const sourceView = block.querySelector('.minidoc-mermaid-source');
  const buttons = block.querySelectorAll('.minidoc-mermaid-button');
  for (const btn of buttons) {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');
      if (view === 'source') {
        if (diagramView) diagramView.setAttribute('hidden', '');
        if (sourceView) sourceView.removeAttribute('hidden');
      } else {
        if (diagramView) diagramView.removeAttribute('hidden');
        if (sourceView) sourceView.setAttribute('hidden', '');
      }
      for (const other of buttons) {
        other.classList.remove('minidoc-active');
      }
      btn.classList.add('minidoc-active');
    });
  }
  if (!diagramView) {
    continue;
  }
  const pan = diagramView.querySelector('.minidoc-mermaid-pan');
  if (!pan) {
    continue;
  }
  let isPanning = false;
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;
  const defaultScale = 2;
  const readPosition = () => {
    const x = Number.parseFloat(pan.getAttribute('data-x') || '0');
    const y = Number.parseFloat(pan.getAttribute('data-y') || '0');
    return { x, y };
  };
  const readScale = () => Number.parseFloat(pan.getAttribute('data-scale') || String(defaultScale));
  const applyTransform = (x, y, scale) => {
    pan.setAttribute('data-x', String(x));
    pan.setAttribute('data-y', String(y));
    pan.setAttribute('data-scale', String(scale));
    pan.style.transform = 'translate(' + x + 'px, ' + y + 'px) scale(' + scale + ')';
  };
  const applyPosition = (x, y) => {
    applyTransform(x, y, readScale());
  };
  diagramView.addEventListener('pointerdown', (event) => {
    isPanning = true;
    diagramView.classList.add('minidoc-panning');
    diagramView.setPointerCapture(event.pointerId);
    startX = event.clientX;
    startY = event.clientY;
    const current = readPosition();
    originX = current.x;
    originY = current.y;
  });
  diagramView.addEventListener('pointermove', (event) => {
    if (!isPanning) {
      return;
    }
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    applyPosition(originX + dx, originY + dy);
  });
  diagramView.addEventListener('wheel', (event) => {
    event.preventDefault();
    const current = readPosition();
    const currentScale = readScale();
    const step = event.deltaY > 0 ? 0.9 : 1.1;
    const nextScale = Math.min(4, Math.max(0.2, currentScale * step));
    applyTransform(current.x, current.y, nextScale);
  });
  const stopPan = () => {
    if (!isPanning) {
      return;
    }
    isPanning = false;
    diagramView.classList.remove('minidoc-panning');
  };
  diagramView.addEventListener('pointerup', stopPan);
  diagramView.addEventListener('pointerleave', stopPan);
  diagramView.addEventListener('pointercancel', stopPan);
}
mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
});
await whenLoaded();
await mermaid.run({
  querySelector: '.minidoc-mermaid-diagram .mermaid',
});
for (const block of mermaidBlocks) {
  const diagramView = block.querySelector('.minidoc-mermaid-diagram');
  const pan = diagramView ? diagramView.querySelector('.minidoc-mermaid-pan') : null;
  if (pan) {
    const defaultScale = 2;
    pan.setAttribute('data-scale', String(defaultScale));
    pan.style.transform = 'translate(0px, 0px) scale(' + defaultScale + ')';
  }
}
</script>
</body>
</html>`;

  return {
    original: content,
    output: fullHtml,
    metadata: {
      title,
      processedAt: new Date().toISOString(),
    },
  };
}

/**
 * Escapes HTML special characters in a string.
 *
 * @param text - The text to escape.
 * @returns The escaped text.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
