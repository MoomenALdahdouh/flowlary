const CODE_CLASS =
  /\b(?:hljs|chroma|highlight|prettyprint|prism|language-|cm-editor|cm-content|monaco|ace_|CodeMirror|blob-code|js-file-line)\b/i

export function looksLikeCodeEditor(el: HTMLElement): boolean {
  const cls = `${el.className} ${el.getAttribute('data-mode') ?? ''}`.toLowerCase()
  return (
    cls.includes('monaco') ||
    cls.includes('codemirror') ||
    cls.includes('ace_editor') ||
    cls.includes('cm-editor') ||
    el.closest('.monaco-editor, .CodeMirror, .cm-editor, .ace_editor') !== null ||
    CODE_CLASS.test(cls)
  )
}
