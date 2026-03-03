interface StatusDotProps {
  status: 'connected' | 'offline'
}

export default function StatusDot({ status }: StatusDotProps) {
  return (
    <span
      className={`status-dot status-dot--${status}`}
      title={status === 'connected' ? 'Context store: online' : 'Context store: offline'}
    />
  )
}
