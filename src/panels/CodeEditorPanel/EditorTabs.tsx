import { useRef, useState } from 'react'
import type { EditorTab } from './types'

interface EditorTabsProps {
  tabs: EditorTab[]
  activeId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onAdd: (filename: string) => void
}

export default function EditorTabs({ tabs, activeId, onSelect, onClose, onAdd }: EditorTabsProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const startAdd = () => {
    setIsAdding(true)
    setNewName('')
    // Focus the input on next tick after render
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const commitAdd = () => {
    const name = newName.trim()
    if (name) onAdd(name)
    setIsAdding(false)
    setNewName('')
  }

  const handleInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitAdd()
    if (e.key === 'Escape') { setIsAdding(false); setNewName('') }
  }

  const handleClose = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const tab = tabs.find((t) => t.id === id)
    if (tab?.isDirty) {
      if (!confirm(`Close ${tab.filename}? You have unsaved changes.`)) return
    }
    onClose(id)
  }

  return (
    <div className="editor-tabs">
      <div className="editor-tabs__list">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`editor-tab${tab.id === activeId ? ' editor-tab--active' : ''}`}
            onClick={() => onSelect(tab.id)}
          >
            <span className="editor-tab__name">
              {tab.filename}
              {tab.isDirty && <span className="editor-tab__dirty">●</span>}
            </span>
            <button
              className="editor-tab__close"
              onClick={(e) => handleClose(e, tab.id)}
              aria-label={`Close ${tab.filename}`}
            >
              ×
            </button>
          </div>
        ))}

        {isAdding ? (
          <div className="editor-tab editor-tab--input">
            <input
              ref={inputRef}
              className="editor-tab__input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleInputKey}
              onBlur={commitAdd}
              placeholder="filename.ts"
            />
          </div>
        ) : (
          <button className="editor-tab__add" onClick={startAdd} aria-label="New tab">
            +
          </button>
        )}
      </div>
    </div>
  )
}
