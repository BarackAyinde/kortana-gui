import type * as Monaco from 'monaco-editor'

export const THEME_NAME = 'kortana-dark'

export function defineKortanaTheme(monaco: typeof Monaco): void {
  monaco.editor.defineTheme(THEME_NAME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword',           foreground: '00ff88', fontStyle: 'bold' },
      { token: 'keyword.control',   foreground: '00ff88', fontStyle: 'bold' },
      { token: 'keyword.operator',  foreground: '00ff88' },
      { token: 'string',            foreground: 'ffaa00' },
      { token: 'string.escape',     foreground: 'ffaa00' },
      { token: 'comment',           foreground: '555555', fontStyle: 'italic' },
      { token: 'comment.line',      foreground: '555555', fontStyle: 'italic' },
      { token: 'comment.block',     foreground: '555555', fontStyle: 'italic' },
      { token: 'number',            foreground: '00ccff' },
      { token: 'type',              foreground: '88aaff' },
      { token: 'variable',          foreground: 'e0e0e0' },
      { token: 'identifier',        foreground: 'e0e0e0' },
    ],
    colors: {
      'editor.background':               '#0d0d0d',
      'editor.foreground':               '#e0e0e0',
      'editor.lineHighlightBackground':  '#151515',
      'editor.selectionBackground':      '#1a3a2a',
      'editor.selectionHighlightBackground': '#1a3a2a99',
      'editorCursor.foreground':         '#00ff88',
      'editorLineNumber.foreground':     '#444444',
      'editorLineNumber.activeForeground': '#888888',
      'editorIndentGuide.background1':   '#222222',
      'editorIndentGuide.activeBackground1': '#333333',
      'editorWidget.background':         '#111111',
      'editorWidget.border':             '#333333',
      'input.background':                '#111111',
      'input.foreground':                '#e0e0e0',
      'scrollbarSlider.background':      '#333333aa',
      'scrollbarSlider.hoverBackground': '#444444cc',
      'diffEditor.insertedTextBackground': '#00ff8822',
      'diffEditor.removedTextBackground':  '#ff333322',
    },
  })
}
