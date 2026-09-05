declare module 'pdfmake/build/pdfmake' {
  const pdfMake: {
    vfs: Record<string, string>
    fonts: Record<string, Record<string, string>>
    createPdf: (doc: unknown) => { getBuffer: (cb: (buffer: Uint8Array) => void) => void }
  }
  export default pdfMake
}

declare module 'pdfmake/build/vfs_fonts' {
  const vfsFonts: { pdfMake?: { vfs: Record<string, string> }; default?: Record<string, string> }
  export default vfsFonts
}

declare module 'pdfmake/interfaces' {
  export type Content = string | number | Content[] | Record<string, unknown>
  export type TDocumentDefinitions = {
    content: Content
    defaultStyle?: Record<string, unknown>
    styles?: Record<string, Record<string, unknown>>
    pageMargins?: number | [number, number] | [number, number, number, number]
    pageSize?: string | { width: number; height: number }
    images?: Record<string, string>
  }
}
