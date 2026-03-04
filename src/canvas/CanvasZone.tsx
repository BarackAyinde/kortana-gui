import { useWindowManagerStore } from '../store/windowManagerStore'
import { PANEL_REGISTRY } from '../panels/PANEL_REGISTRY'
import CanvasWindow from './CanvasWindow'
import ActivePanelsButton from '../ui/ActivePanelsButton'
import type { PanelInstance } from '../types'

function PanelContent({ panel }: { panel: PanelInstance }) {
  const def = PANEL_REGISTRY[panel.type]
  if (def.component) {
    const Component = def.component
    return <Component />
  }
  return (
    <div className="canvas-panel-placeholder">
      <span>{panel.type}</span>
    </div>
  )
}

export default function CanvasZone() {
  const { panels } = useWindowManagerStore()
  const maxZ = panels.reduce((m, p) => Math.max(m, p.zIndex), 0)

  return (
    <div className="canvas-zone" style={{ position: 'relative' }}>
      {panels.length === 0 && (
        <div className="canvas-zone__empty">
          <span className="canvas-zone__hint">⌘K · spawn panel</span>
          <span className="canvas-zone__hint">⌘⇧K · toggle dashboard/canvas</span>
        </div>
      )}

      {panels.map((panel) => (
        <CanvasWindow key={panel.id} panel={panel} focused={panel.zIndex === maxZ}>
          <PanelContent panel={panel} />
        </CanvasWindow>
      ))}

      <ActivePanelsButton />
    </div>
  )
}
