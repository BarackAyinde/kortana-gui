interface DiffHeaderProps {
  filename: string
  onAccept: () => void
  onReject: () => void
}

export default function DiffHeader({ filename, onAccept, onReject }: DiffHeaderProps) {
  return (
    <div className="diff-header">
      <span className="diff-header__filename">{filename}</span>
      <div className="diff-header__actions">
        <button className="diff-header__btn diff-header__btn--accept" onClick={onAccept}>
          ✓ Accept
        </button>
        <button className="diff-header__btn diff-header__btn--reject" onClick={onReject}>
          ✗ Reject
        </button>
      </div>
    </div>
  )
}
