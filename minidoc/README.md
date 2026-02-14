# @dilemmagx/minidoc

Minidoc is a lightweight Markdown-to-HTML documentation generator designed for code-heavy projects. It features advanced code blocks, file inclusion, GFM alerts, and native Mermaid diagram support.

## Features

- **Advanced Code Blocks**: Sticky line numbers, table layout, and copy buttons.
- **File Inclusion**: Include specific line ranges from source files directly into your documentation.
- **Mermaid Support**: Native rendering of Mermaid diagrams with zoom, pan, and source view toggling.
- **GFM Alerts**: GitHub-flavored markdown alerts (Note, Tip, Important, Warning, Caution).
- **Clean Typography**: Optimized for readability with responsive design.
- **Collapsible Sections**: Organize content with collapsible details blocks.

## Install

```bash
npm install @dilemmagx/minidoc
```

## CLI Usage

```bash
minidoc build <input-file> [options]
```

### Options

- `-o, --output <path>`: Specify the output HTML file path.
- `-t, --title <title>`: Set the HTML page title (default: "Minidoc").
- `-v, --verbose`: Enable verbose logging.
- `--no-copy`: Disable the copy button on code blocks.

### Example

```bash
minidoc build docs/index.md -o docs/index.html --title "My Documentation"
```

## Syntax Guide

### File Inclusion

Include code snippets from other files using the `{{ ... }}` syntax.

```
{{ "filePath", startLine, endLine, [displayStartLine], [isCollapsible], [defaultCollapsed], [enableTitle], [customTitle], [wordWrap] }}
```

**Parameters:**

1. `filePath` (string): Path to the source file (relative to `cwd`).
2. `startLine` (number): Starting line number (1-based).
3. `endLine` (number): Ending line number (1-based).
4. `displayStartLine` (number, optional): Line number shown in the gutter.
5. `isCollapsible` (boolean, optional): Enable collapsible block.
6. `defaultCollapsed` (boolean, optional): Start collapsed.
7. `enableTitle` (boolean, optional): Show a title header.
8. `customTitle` (string, optional): Custom title text.
9. `wordWrap` (boolean, optional): Override global wrap setting.

**Examples:**

```
{{ "src/index.ts", 1, 10 }}
```

```
{{ "src/core.ts", 50, 80, 50, true, true, true, "Core Logic" }}
```

### Mermaid Diagrams

Minidoc supports Mermaid diagrams out of the box. Use the `mermaid` language fence.

````markdown
```mermaid
graph TD;
    A-->B;
    A-->C;
    B-->D;
    C-->D;
```
````

**Features:**

- **Zoom & Pan**: Use mouse wheel to zoom, drag to pan.
- **Source View**: Toggle between the rendered diagram and the source code.
- **Copy**: Copy the Mermaid source code to clipboard.

### GFM Alerts

Standard GitHub Flavored Markdown alerts are supported.

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
