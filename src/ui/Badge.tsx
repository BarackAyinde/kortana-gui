interface BadgeProps {
  label: string
  variant?: 'dim' | 'active'
  onClick?: () => void
  title?: string
}

export default function Badge({ label, variant = 'dim', onClick, title }: BadgeProps) {
  return (
    <span
      className={`badge badge--${variant}${onClick ? ' badge--clickable' : ''}`}
      onClick={onClick}
      title={title}
      role={onClick ? 'button' : undefined}
    >
      {label}
    </span>
  )
}
