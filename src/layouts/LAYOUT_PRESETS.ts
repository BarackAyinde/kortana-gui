import type { LayoutPreset } from '../types'

// ─── INTELLIGENCE ─────────────────────────────────────────────────────────────
// Context graph (60%) | Map (40%) — single row
// ┌────────────────────┬─────────────┐
// │  context           │  map        │
// └────────────────────┴─────────────┘

// ─── ANALYSIS ─────────────────────────────────────────────────────────────────
// Context (left, full height) | Delta (top-right) | Log (bottom-right)
// ┌──────────┬──────────┐
// │          │ delta    │
// │ context  ├──────────┤
// │          │   log    │
// └──────────┴──────────┘

// ─── TRADING ──────────────────────────────────────────────────────────────────
// Signal Intelligence (top-left) | Strategy Monitor (top-right)
// Trade Engine (bottom-left)     | Market View (bottom-right)
// ┌─────────────────┬──────────────────┐
// │  signal-intel   │ strategy-monitor │
// ├─────────────────┼──────────────────┤
// │  trade-engine   │    trading       │
// └─────────────────┴──────────────────┘

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'architecture',
    label: 'ARCHITECTURE',
    gridTemplate: '',
    gridCols: '',
    gridRows: '',
    slots: [],
    standalone: true,
  },
  {
    id: 'intelligence',
    label: 'INTELLIGENCE',
    gridTemplate: '"context map"',
    gridCols: '3fr 2fr',
    gridRows: '1fr',
    slots: [
      { area: 'context', panelType: 'context' },
      { area: 'map',     panelType: 'map' },
    ],
  },
  {
    id: 'engineering',
    label: 'ENGINEERING',
    gridTemplate: '"context delta" "context log"',
    gridCols: '2fr 1fr',
    gridRows: '1fr 1fr',
    slots: [
      { area: 'context', panelType: 'context' },
      { area: 'delta',   panelType: 'delta' },
      { area: 'log',     panelType: 'log' },
    ],
  },
  {
    id: 'trading',
    label: 'TRADING',
    gridTemplate: '"trading" "signal-intel trade-engine strategy-monitor"',
    gridCols: '1fr',
    gridRows: '3fr 2fr',
    slots: [
      { area: 'trading',           panelType: 'trading' },
      { area: 'signal-intel',      panelType: 'signal-intel' },
      { area: 'trade-engine',      panelType: 'trade-engine' },
      { area: 'strategy-monitor',  panelType: 'strategy-monitor' },
    ],
  },
]
