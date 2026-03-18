export type EditorMode = 'edit' | 'diff'

export interface EditorTab {
  id: string
  filename: string
  content: string
  language: string
  isDirty: boolean
}

export interface DiffPayload {
  file: string
  original: string
  proposed: string
}
