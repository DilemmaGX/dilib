# Minidoc

Minidoc is a lightweight, powerful Markdown documentation generator designed for creating beautiful, code-centric documentation. It extends standard Markdown with advanced code block features, GitHub Flavored Markdown (GFM) alerts, and seamless file inclusion capabilities.

## Features

- **Advanced Code Blocks**: 
  - Table-based layout with row-per-line alignment.
  - Sticky line numbers for horizontal scrolling.
  - Syntax highlighting via [highlight.js](https://highlightjs.org/).
  - Wrap vs. No-wrap support.
- **Collapsible Code Sections**: Easily create collapsible code blocks with optional titles.
- **File Inclusion**: Embed specific lines from source files directly into your documentation using a custom syntax.
- **GitHub Flavored Markdown Alerts**: Native support for GFM alerts (Note, Tip, Important, Warning, Caution) with proper styling and icons.
- **Beautiful Typography**: Uses "Maple Mono NF CN" font for code and system fonts for UI.

## Installation

```bash
npm install minidoc
```

## Usage

Minidoc is a CLI tool for generating documentation from Markdown files.

```bash
minidoc <input-file> [output-file] [options]
```

**Options:**

- `-t, --title <title>`: Set the title of the generated HTML page.
- `--no-wrap`: Disable word wrapping for code blocks (enables horizontal scrolling).
- `-v, --verbose`: Enable verbose logging.

**Example:**

```bash
minidoc docs/index.md docs/index.html --title "My Documentation"
```

## Syntax Guide

### File Inclusion

Minidoc allows you to include code snippets from external files using the `{{ ... }}` syntax. This is perfect for keeping your documentation in sync with your actual code.

**Syntax:**

```
{{ "filePath", startLine, endLine, [displayStartLine], [isCollapsible], [defaultCollapsed], [enableTitle], [customTitle], [wordWrap] }}
```

**Parameters:**

1.  `filePath` (string): Path to the source file (relative to `cwd`).
2.  `startLine` (number): Starting line number (1-based).
3.  `endLine` (number): Ending line number (1-based).
4.  `displayStartLine` (number, optional): Line number to display in the gutter (default: `startLine`).
5.  `isCollapsible` (boolean, optional): Whether the block is collapsible (default: `false`).
6.  `defaultCollapsed` (boolean, optional): Whether it starts collapsed (default: `false`).
7.  `enableTitle` (boolean, optional): Whether to show a title header (default: `false`).
8.  `customTitle` (string, optional): Custom title text. If empty and title enabled, shows `path:start-end`.
9.  `wordWrap` (boolean, optional): Override global word wrap setting for this block.

**Examples:**

*Basic inclusion:*
```
{{ "src/index.ts", 1, 10 }}
```

*Collapsible block with title:*
```
{{ "src/core.ts", 50, 80, 50, true, true, true, "Core Logic" }}
```

*No-wrap specific block:*
```
{{ "src/utils.ts", 1, 20, 1, false, false, true, "Utils", false }}
```

### GFM Alerts

Minidoc supports standard GitHub Flavored Markdown alerts:

```markdown
> [!NOTE]
> This is a note.

> [!TIP]
> This is a helpful tip.

> [!IMPORTANT]
> This is crucial information.

> [!WARNING]
> Proceed with caution.

> [!CAUTION]
> This action can have negative consequences.
```

## License

GPL-3.0
