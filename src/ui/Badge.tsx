interface BadgeProps {
  label: string
  variant?: 'dim' | 'active'
}

export default function Badge({ label, variant = 'dim' }: BadgeProps) {
  return <span className={`badge badge--${variant}`}>{label}</span>
}
