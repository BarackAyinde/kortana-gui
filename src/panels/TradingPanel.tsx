import { useEffect, useState } from 'react'

const QUANT_URL = 'http://localhost:4003/api'

// Instrument universe surfaced in the panel (subset of kortana-quant config)
const INSTRUMENTS = [
  { ticker: 'QQQ',     label: 'QQQ',  sub: 'NASDAQ-100' },
  { ticker: 'SPY',     label: 'SPY',  sub: 'S&P 500'    },
  { ticker: 'BTC-USD', label: 'BTC',  sub: 'BITCOIN'    },
  { ticker: 'ETH-USD', label: 'ETH',  sub: 'ETHEREUM'   },
  { ticker: 'BP.L',    label: 'BP.L', sub: 'LONDON'     },
] as const

type Ticker = (typeof INSTRUMENTS)[number]['ticker']

interface Bar { ts: string; open: number; high: number; low: number; close: number; volume: number | null }
interface TCSignal {
  tc_period: number
  tc_trend: string
  tc_channel_upper: number | null
  tc_channel_lower: number | null
  tc_worry_line: number | null
  tc_pivot_high: number | null
  tc_pivot_low: number | null
  bars_since_pivot: number | null
}

interface InstData { bars: Bar[]; is_partial: boolean }
type Status = 'loading' | 'live' | 'simulated'

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(price: number): string {
  if (price >= 10000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (price >= 1000)  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (price >= 10)    return price.toFixed(2)
  return price.toFixed(4)
}

function pctChange(current: number, prev: number): number {
  return ((current - prev) / prev) * 100
}

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const W = 300; const H = 50
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * (H - 2) + 1}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="trading-sparkline">
      <polyline
        points={pts}
        fill="none"
        stroke={up ? 'var(--accent-green)' : 'var(--accent-red)'}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ─── API calls ───────────────────────────────────────────────────────────────

async function fetchPrices(ticker: string): Promise<InstData | null> {
  try {
    const r = await fetch(`${QUANT_URL}/market/prices?ticker=${ticker}&interval=1d&period=90d`)
    if (!r.ok) return null
    const d = await r.json()
    return { bars: d.bars, is_partial: d.is_partial }
  } catch {
    return null
  }
}

async function fetchSignals(ticker: string): Promise<TCSignal[]> {
  try {
    const r = await fetch(`${QUANT_URL}/market/signals?ticker=${ticker}&interval=1d&tc_periods=14,42,126`)
    if (!r.ok) return []
    const d = await r.json()
    return d.signals ?? []
  } catch {
    return []
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TradingPanel() {
  const [selected, setSelected] = useState<Ticker>('QQQ')
  const [priceMap, setPriceMap] = useState<Partial<Record<Ticker, InstData>>>({})
  const [signals, setSignals] = useState<TCSignal[]>([])
  const [status, setStatus] = useState<Status>('loading')

  // Load all instrument prices in parallel on mount
  useEffect(() => {
    let cancelled = false
    async function loadAll() {
      const results = await Promise.all(
        INSTRUMENTS.map(({ ticker }) => fetchPrices(ticker).then(d => [ticker, d] as const))
      )
      if (cancelled) return
      const map: Partial<Record<Ticker, InstData>> = {}
      let anyLive = false
      for (const [ticker, data] of results) {
        if (data && data.bars.length > 0) {
          map[ticker] = data
          anyLive = true
        }
      }
      setPriceMap(map)
      setStatus(anyLive ? 'live' : 'simulated')
    }
    loadAll()
    return () => { cancelled = true }
  }, [])

  // Load TC signals whenever selected ticker changes
  useEffect(() => {
    let cancelled = false
    fetchSignals(selected).then(sigs => {
      if (!cancelled) setSignals(sigs)
    })
    return () => { cancelled = true }
  }, [selected])

  const selIdx  = INSTRUMENTS.findIndex(i => i.ticker === selected)
  const selInst = INSTRUMENTS[selIdx]!
  const selData = priceMap[selected]
  const selBars = selData?.bars ?? []
  const closes  = selBars.map(b => b.close)

  const currentPrice = closes.at(-1) ?? null
  const prevClose    = closes.at(-2) ?? closes.at(0) ?? null
  const change       = currentPrice !== null && prevClose !== null ? pctChange(currentPrice, prevClose) : null
  const up           = change !== null ? change >= 0 : true

  // TC-14 signal for the selected instrument
  const tc14 = signals.find(s => s.tc_period === 14)
  const tcTrend = tc14?.tc_trend ?? null
  const worryLine = tc14?.tc_worry_line ?? null

  const others = INSTRUMENTS.filter(i => i.ticker !== selected)

  return (
    <div className="trading-panel">
      {/* Header */}
      <div className="trading-panel__header">
        <button
          className="icon-btn"
          disabled={selIdx <= 0}
          onClick={() => setSelected(INSTRUMENTS[selIdx - 1]!.ticker)}
        >◂</button>

        <span className="trading-panel__pair">{selInst.label}</span>
        <span style={{ fontSize: 8, color: 'var(--text-ghost)', letterSpacing: '0.1em' }}>
          {selInst.sub}
        </span>

        <button
          className="icon-btn"
          disabled={selIdx >= INSTRUMENTS.length - 1}
          onClick={() => setSelected(INSTRUMENTS[selIdx + 1]!.ticker)}
        >▸</button>

        <span
          className="trading-panel__sim"
          style={{ color: status === 'live' ? 'var(--accent-green)' : undefined }}
        >
          {status === 'loading' ? 'LOADING' : status === 'live' ? 'LIVE' : 'SIM'}
        </span>
      </div>

      {/* Main */}
      <div className="trading-panel__main">
        {currentPrice !== null ? (
          <>
            <div className="trading-panel__price">${fmt(currentPrice)}</div>
            {change !== null && (
              <div className={`trading-panel__change trading-panel__change--${up ? 'up' : 'dn'}`}>
                {up ? '+' : ''}{change.toFixed(2)}%
                {' '}
                <span style={{ fontSize: 9, opacity: 0.6, marginLeft: 4, letterSpacing: '0.05em' }}>
                  1D
                </span>
              </div>
            )}
            {/* TC signal row */}
            {tcTrend && tcTrend !== 'neutral' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{
                  fontSize: 9,
                  letterSpacing: '0.12em',
                  color: tcTrend === 'up' ? 'var(--accent-green)' : 'var(--accent-red)',
                  border: `1px solid ${tcTrend === 'up' ? 'var(--accent-green)' : 'var(--accent-red)'}`,
                  padding: '1px 5px',
                }}>
                  TC {tcTrend === 'up' ? '▲' : '▼'} {tcTrend.toUpperCase()}
                </span>
                {worryLine !== null && (
                  <span style={{ fontSize: 9, color: 'var(--text-ghost)', letterSpacing: '0.05em' }}>
                    wl ${fmt(worryLine)}
                  </span>
                )}
              </div>
            )}
            <Sparkline data={closes.slice(-60)} up={up} />
          </>
        ) : (
          <div style={{ color: 'var(--text-ghost)', fontSize: 11, textAlign: 'center' }}>
            {status === 'loading' ? 'fetching…' : 'no data'}
          </div>
        )}
      </div>

      {/* Footer — other 4 instruments */}
      <div className="trading-panel__footer">
        {others.map(({ ticker, label }) => {
          const d = priceMap[ticker]
          const bs = d?.bars ?? []
          const price = bs.at(-1)?.close ?? null
          const prev  = bs.at(-2)?.close ?? bs.at(0)?.close ?? null
          const p = price !== null && prev !== null ? pctChange(price, prev) : null
          const isUp = p !== null ? p >= 0 : true

          return (
            <button key={ticker} className="trading-mini" onClick={() => setSelected(ticker)}>
              <span className="trading-mini__sym">{label}</span>
              <span className="trading-mini__price">
                {price !== null ? `$${fmt(price)}` : '—'}
              </span>
              <span className={`trading-mini__pct trading-mini__pct--${isUp ? 'up' : 'dn'}`}>
                {p !== null ? `${isUp ? '+' : ''}${p.toFixed(2)}%` : '—'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
