import { useCallback, useEffect, useRef, useState } from 'react'
import Map, { Marker, type MapMouseEvent, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

const DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const INTEL_API = 'http://localhost:4002/api'
const LS_KEY = 'kortana.map.layers'

// ── Country centroids (newsworthy subset) ─────────────────────────────────────
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  AF: [67.7, 33.9], AL: [20.2, 41.2], DZ: [2.6, 28.0], AO: [17.9, -11.2],
  AR: [-63.6, -38.4], AM: [45.0, 40.1], AU: [133.8, -25.3], AT: [14.6, 47.7],
  AZ: [47.6, 40.1], BD: [90.4, 23.7], BY: [28.0, 53.7], BE: [4.5, 50.5],
  BO: [-64.7, -16.3], BA: [17.7, 44.0], BR: [-51.9, -14.2], BG: [25.5, 42.7],
  KH: [104.9, 12.6], CM: [12.4, 3.9], CA: [-96.8, 56.1], CL: [-71.5, -35.7],
  CN: [104.2, 35.9], CO: [-74.3, 4.1], CD: [23.7, -4.0], CR: [-83.8, 10.0],
  HR: [15.2, 45.1], CU: [-79.5, 22.0], CZ: [15.5, 49.8], DK: [9.5, 56.3],
  DO: [-70.2, 18.7], EC: [-77.4, -1.8], EG: [30.8, 26.8], ET: [40.5, 9.1],
  FI: [26.3, 64.0], FR: [2.2, 46.2], DE: [10.5, 51.2], GH: [-1.0, 7.9],
  GR: [21.8, 39.1], GT: [-90.2, 15.8], HN: [-86.2, 15.2], HK: [114.2, 22.3],
  HU: [19.5, 47.2], IN: [78.7, 20.6], ID: [113.9, -0.8], IR: [53.7, 32.4],
  IQ: [43.7, 33.2], IE: [-8.2, 53.4], IL: [34.9, 31.5], IT: [12.6, 42.8],
  JP: [138.3, 36.2], JO: [36.2, 31.2], KZ: [66.9, 48.0], KE: [37.9, 0.0],
  KP: [127.5, 40.3], KR: [127.8, 35.9], XK: [20.9, 42.6], KW: [47.5, 29.3],
  LB: [35.9, 33.9], LY: [17.2, 26.3], ML: [-2.0, 17.6], MX: [-102.6, 23.6],
  MA: [-7.1, 31.8], MZ: [35.5, -18.7], MM: [96.7, 19.2], NP: [84.1, 28.4],
  NL: [5.3, 52.1], NZ: [174.9, -40.9], NI: [-85.2, 12.9], NG: [8.7, 9.1],
  NO: [8.5, 60.5], PK: [69.3, 30.4], PA: [-80.8, 8.5], PY: [-58.4, -23.4],
  PE: [-75.0, -9.2], PH: [122.9, 12.9], PL: [19.1, 52.0], PT: [-8.2, 39.4],
  PR: [-66.6, 18.2], QA: [51.2, 25.4], RO: [24.9, 45.9], RU: [105.3, 61.5],
  RW: [29.9, -1.9], SA: [45.1, 23.9], SN: [-14.5, 14.5], RS: [21.0, 44.0],
  SL: [-11.8, 8.5], SO: [46.2, 5.2], ZA: [25.1, -28.5], SS: [31.3, 7.0],
  ES: [-3.7, 40.5], LK: [80.7, 7.9], SD: [29.9, 12.9], SE: [17.0, 63.0],
  CH: [8.2, 46.8], SY: [38.6, 35.0], TW: [120.9, 23.7], TJ: [71.3, 38.9],
  TZ: [34.9, -6.4], TH: [100.9, 15.9], TN: [9.6, 33.9], TR: [35.2, 39.1],
  TM: [58.4, 38.9], UA: [31.2, 48.4], AE: [53.8, 23.4], GB: [-3.4, 55.4],
  US: [-95.7, 37.1], UZ: [63.9, 41.4], VE: [-66.6, 6.4], VN: [108.3, 14.1],
  YE: [47.6, 15.6], ZM: [27.8, -13.1], ZW: [29.9, -20.0], PS: [35.1, 31.9],
  MK: [21.7, 41.6], ME: [19.4, 42.7], GE: [43.4, 42.3], MN: [103.8, 46.8],
}

type GeoFeature = {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: Record<string, string | number | null>
}
type GeoCollection = {
  type: 'FeatureCollection'
  features: GeoFeature[]
  meta?: { count: number }
}
type LayerState = {
  stories: boolean
  signals: boolean
  blindspots: boolean
  alerts: boolean
}
type Popup = {
  lng: number
  lat: number
  props: Record<string, string | number | null>
  kind: 'story' | 'signal' | 'blindspot'
}
type AlertItem = {
  country: string
  type: 'surge' | 'spike'
  count?: number
  ratio?: number
}

const EMPTY: GeoCollection = { type: 'FeatureCollection', features: [] }
const SEVERITY_COLOR: Record<string, string> = {
  critical: '#ff4444',
  high:     '#ffb300',
  medium:   '#00c4ff',
  low:      '#6060c0',
  info:     '#404070',
}
function severityColor(s: string | null | undefined) {
  return SEVERITY_COLOR[s ?? ''] ?? SEVERITY_COLOR.info
}

function loadLayerState(): LayerState {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return { stories: true, signals: true, blindspots: false, alerts: true, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { stories: true, signals: true, blindspots: false, alerts: true }
}

// ── Relative time ──────────────────────────────────────────────────────────────
function relTime(iso: string | number | null | undefined): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(String(iso)).getTime()
  if (isNaN(ms)) return ''
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function MapPanel() {
  const mapRef = useRef<MapRef>(null)
  const [coords, setCoords] = useState<{ lng: number; lat: number } | null>(null)
  const [layers, setLayers] = useState<LayerState>(loadLayerState)
  const [stories, setStories] = useState<GeoCollection>(EMPTY)
  const [signalsData, setSignalsData] = useState<GeoCollection>(EMPTY)
  const [blindspotsData, setBlindspotsData] = useState<GeoCollection>(EMPTY)
  const [alertsData, setAlertsData] = useState<AlertItem[]>([])
  const [popup, setPopup] = useState<Popup | null>(null)
  const [intelStatus, setIntelStatus] = useState<'live' | 'offline'>('offline')
  const [storyCount, setStoryCount] = useState(0)
  const [signalCount, setSignalCount] = useState(0)
  const [alertCount, setAlertCount] = useState(0)
  const [hours, setHours] = useState(24)

  // Persist layer toggles
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(layers)) } catch { /* ignore */ }
  }, [layers])

  // Health check every 10s
  useEffect(() => {
    const check = () =>
      fetch(`${INTEL_API}/health`)
        .then(r => r.ok ? setIntelStatus('live') : setIntelStatus('offline'))
        .catch(() => setIntelStatus('offline'))
    check()
    const t = setInterval(check, 10_000)
    return () => clearInterval(t)
  }, [])

  // Fetch stories every 5 min
  const fetchStories = useCallback(() => {
    if (intelStatus !== 'live') return
    fetch(`${INTEL_API}/stories?hours=${hours}&min_confidence=0.2&limit=500`)
      .then(r => r.json())
      .then((d: GeoCollection) => { setStories(d); setStoryCount(d.features.length) })
      .catch(() => {})
  }, [intelStatus, hours])

  // Fetch signals every 15 min
  const fetchSignals = useCallback(() => {
    if (intelStatus !== 'live') return
    fetch(`${INTEL_API}/signals?hours=${hours}&limit=500`)
      .then(r => r.json())
      .then((d: GeoCollection) => { setSignalsData(d); setSignalCount(d.features.length) })
      .catch(() => {})
  }, [intelStatus, hours])

  // Fetch blindspots every 15 min
  const fetchBlinspots = useCallback(() => {
    if (intelStatus !== 'live') return
    fetch(`${INTEL_API}/blindspots`)
      .then(r => r.json())
      .then((d: { blindspots: Record<string, string | number | null>[] }) => {
        const features: GeoFeature[] = d.blindspots
          .filter(b => b.lat != null && b.lon != null)
          .map(b => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [b.lon as number, b.lat as number] },
            properties: b,
          }))
        setBlindspotsData({ type: 'FeatureCollection', features })
      })
      .catch(() => {})
  }, [intelStatus])

  // Fetch alerts every 5 min
  const fetchAlerts = useCallback(() => {
    if (intelStatus !== 'live') return
    fetch(`${INTEL_API}/alerts`)
      .then(r => r.json())
      .then((d: { alerts: AlertItem[]; meta: { count: number } }) => {
        setAlertsData(d.alerts)
        setAlertCount(d.meta.count)
      })
      .catch(() => {})
  }, [intelStatus])

  useEffect(() => {
    fetchStories(); fetchSignals(); fetchBlinspots(); fetchAlerts()
    const t1 = setInterval(fetchStories, 5 * 60_000)
    const t2 = setInterval(fetchSignals, 15 * 60_000)
    const t3 = setInterval(fetchBlinspots, 15 * 60_000)
    const t4 = setInterval(fetchAlerts, 5 * 60_000)
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3); clearInterval(t4) }
  }, [fetchStories, fetchSignals, fetchBlinspots, fetchAlerts])

  // Sync all MapLibre sources when data or visibility changes
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || !map.isStyleLoaded()) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = map as any
    m.getSource('intel-stories')?.setData(layers.stories ? stories : EMPTY)
    m.getSource('intel-signals')?.setData(layers.signals ? signalsData : EMPTY)
    m.getSource('intel-blindspots')?.setData(layers.blindspots ? blindspotsData : EMPTY)
  }, [stories, signalsData, blindspotsData, layers])

  const onMouseMove = useCallback((e: MapMouseEvent) => setCoords({ lng: e.lngLat.lng, lat: e.lngLat.lat }), [])
  const onMouseLeave = useCallback(() => setCoords(null), [])

  const onMapClick = useCallback((e: MapMouseEvent) => {
    const map = mapRef.current?.getMap()
    if (!map) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = map as any
    for (const [layerId, kind] of [
      ['intel-blindspots-dots', 'blindspot'],
      ['intel-signals-dots',    'signal'],
      ['intel-stories-dots',    'story'],
    ] as const) {
      const hits = m.queryRenderedFeatures(e.point, { layers: [layerId] })
      if (hits?.length) {
        setPopup({ lng: e.lngLat.lng, lat: e.lngLat.lat, props: hits[0].properties, kind })
        return
      }
    }
    setPopup(null)
  }, [])

  const onMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = map as any

    // ── Stories layer ──────────────────────────────────────────────────────────
    m.addSource('intel-stories', { type: 'geojson', data: EMPTY })
    m.addLayer({
      id: 'intel-stories-dots', type: 'circle', source: 'intel-stories',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 3, 6, 6, 10, 9],
        'circle-color': '#00c4ff',
        'circle-opacity': 0.85,
        'circle-stroke-width': 1,
        'circle-stroke-color': 'rgba(0,0,0,0.4)',
      },
    })

    // ── Signals layer ──────────────────────────────────────────────────────────
    m.addSource('intel-signals', { type: 'geojson', data: EMPTY })
    m.addLayer({
      id: 'intel-signals-dots', type: 'circle', source: 'intel-signals',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 4, 6, 7, 10, 11],
        'circle-color': ['match', ['get', 'severity'],
          'critical', '#ff4444', 'high', '#ffb300', 'medium', '#ff8c00', '#c04000'],
        'circle-opacity': 0.7,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': ['match', ['get', 'severity'],
          'critical', '#ff4444', 'high', '#ffb300', '#c04000'],
      },
    })

    // ── Blindspots layer (hollow amber circles) ────────────────────────────────
    m.addSource('intel-blindspots', { type: 'geojson', data: EMPTY })
    m.addLayer({
      id: 'intel-blindspots-dots', type: 'circle', source: 'intel-blindspots',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 5, 6, 9, 10, 14],
        'circle-color': 'transparent',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffb300',
        'circle-opacity': 0,
        'circle-stroke-opacity': 0.9,
      },
    })

    for (const id of ['intel-stories-dots', 'intel-signals-dots', 'intel-blindspots-dots']) {
      m.on('mouseenter', id, () => { m.getCanvas().style.cursor = 'pointer' })
      m.on('mouseleave', id, () => { m.getCanvas().style.cursor = '' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Resolved alert markers (country code → centroid)
  const alertMarkers = layers.alerts
    ? alertsData
        .map(a => {
          const coords = COUNTRY_CENTROIDS[a.country]
          return coords ? { ...a, lng: coords[0], lat: coords[1] } : null
        })
        .filter(Boolean) as (AlertItem & { lng: number; lat: number })[]
    : []

  return (
    <div className="map-panel">
      <Map
        ref={mapRef}
        mapStyle={DARK_STYLE}
        initialViewState={{ longitude: 20, latitude: 20, zoom: 1.8 }}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onClick={onMapClick}
        onLoad={onMapLoad}
      >
        {/* Alert pulse markers */}
        {alertMarkers.map(a => (
          <Marker key={a.country} longitude={a.lng} latitude={a.lat} anchor="center">
            <div
              className={`alert-ring alert-ring--${a.type}`}
              title={`${a.country}: ${a.type === 'surge' ? `${a.count} stories` : `${a.ratio}× spike`}`}
            />
          </Marker>
        ))}
      </Map>

      {/* Layer control */}
      <div className="map-layer-ctrl">
        <div className="map-layer-ctrl__title">INTEL MAP</div>

        <label className="map-layer-ctrl__row">
          <input type="checkbox" checked={layers.stories} onChange={e => setLayers(l => ({ ...l, stories: e.target.checked }))} />
          <span className="map-layer-ctrl__dot" style={{ background: '#00c4ff' }} />
          LATEST NEWS
          {intelStatus === 'live' && <span className="map-layer-ctrl__count">{storyCount}</span>}
        </label>

        <label className="map-layer-ctrl__row">
          <input type="checkbox" checked={layers.signals} onChange={e => setLayers(l => ({ ...l, signals: e.target.checked }))} />
          <span className="map-layer-ctrl__dot" style={{ background: '#ff8c00' }} />
          GLOBAL SIGNALS
          {intelStatus === 'live' && <span className="map-layer-ctrl__count">{signalCount}</span>}
        </label>

        <label className="map-layer-ctrl__row">
          <input type="checkbox" checked={layers.blindspots} onChange={e => setLayers(l => ({ ...l, blindspots: e.target.checked }))} />
          <span className="map-layer-ctrl__dot map-layer-ctrl__dot--hollow" />
          BLINDSPOTS
        </label>

        <label className="map-layer-ctrl__row">
          <input type="checkbox" checked={layers.alerts} onChange={e => setLayers(l => ({ ...l, alerts: e.target.checked }))} />
          <span className="map-layer-ctrl__dot map-layer-ctrl__dot--alert" />
          ALERTS
          {intelStatus === 'live' && alertCount > 0 && (
            <span className="map-layer-ctrl__count map-layer-ctrl__count--alert">{alertCount}</span>
          )}
        </label>

        <div className="map-layer-ctrl__divider" />
        <div className="map-layer-ctrl__time">
          <span>WINDOW</span>
          <select value={hours} onChange={e => setHours(Number(e.target.value))}>
            <option value={6}>6h</option>
            <option value={24}>24h</option>
            <option value={48}>48h</option>
            <option value={168}>7d</option>
          </select>
        </div>
        <div className="map-layer-ctrl__divider" />
        <div className={`map-layer-ctrl__status map-layer-ctrl__status--${intelStatus}`}>
          {intelStatus === 'live' ? '● INTEL LIVE' : '○ INTEL OFFLINE'}
        </div>
      </div>

      {/* Legend */}
      <div className="map-legend">
        {(['critical', 'high', 'medium'] as const).map(sev => (
          <span key={sev} className="map-legend__item">
            <span className="map-legend__dot" style={{ background: SEVERITY_COLOR[sev] }} />
            {sev.toUpperCase()}
          </span>
        ))}
        <span className="map-legend__item">
          <span className="map-legend__dot map-legend__dot--hollow" />
          BLINDSPOT
        </span>
        <span className="map-legend__item">
          <span className="map-legend__dot map-legend__dot--alert-pulse" />
          ALERT
        </span>
      </div>

      {/* Popup */}
      {popup && (
        <div className="map-popup">
          <button className="map-popup__close" onClick={() => setPopup(null)}>×</button>

          {popup.kind === 'blindspot' ? (
            <>
              <div className="map-popup__source map-popup__source--warn">⚠ BLINDSPOT DETECTED</div>
              <div className="map-popup__title">
                {String(popup.props.title ?? popup.props.description ?? 'Uncovered signal')}
              </div>
              <div className="map-popup__meta">
                <span className="map-popup__location">
                  {String(popup.props.reason ?? '').replace('_', ' ').toUpperCase()}
                </span>
                <span className="map-popup__sev" style={{ color: '#ffb300' }}>
                  SCORE {String(popup.props.score ?? '')}
                </span>
              </div>
            </>
          ) : popup.kind === 'signal' ? (
            <>
              <div className="map-popup__source">GDELT — {String(popup.props.source ?? '').toUpperCase()}</div>
              <div className="map-popup__title">{String(popup.props.description ?? popup.props.event_type ?? '')}</div>
              <div className="map-popup__meta">
                <span className="map-popup__location">◎ {String(popup.props.location ?? popup.props.country ?? '')}</span>
                <span className="map-popup__sev" style={{ color: severityColor(popup.props.severity as string) }}>
                  {String(popup.props.severity ?? '').toUpperCase()}
                </span>
              </div>
              {popup.props.url && (
                <a className="map-popup__link" href={String(popup.props.url)} target="_blank" rel="noreferrer">
                  Source →
                </a>
              )}
            </>
          ) : (
            <>
              <div className="map-popup__header">
                <div className="map-popup__source">{String(popup.props.source ?? '').toUpperCase()}</div>
                <div className="map-popup__time">{relTime(popup.props.published)}</div>
              </div>
              <div className="map-popup__title">{String(popup.props.title ?? '')}</div>
              <div className="map-popup__meta">
                {popup.props.location && (
                  <span className="map-popup__location">◎ {String(popup.props.location)}</span>
                )}
                <span className="map-popup__sev" style={{ color: severityColor(popup.props.severity as string) }}>
                  {String(popup.props.severity ?? 'info').toUpperCase()}
                </span>
                {Number(popup.props.source_count ?? 1) > 1 && (
                  <span className="map-popup__sources-badge">
                    {String(popup.props.source_count)} sources
                  </span>
                )}
              </div>
              {popup.props.url && (
                <a className="map-popup__link" href={String(popup.props.url)} target="_blank" rel="noreferrer">
                  Read full story →
                </a>
              )}
            </>
          )}
        </div>
      )}

      {/* Coordinate readout */}
      {coords && (
        <div className="map-coords">
          {coords.lat.toFixed(4)}° {coords.lat >= 0 ? 'N' : 'S'} &nbsp;
          {Math.abs(coords.lng).toFixed(4)}° {coords.lng >= 0 ? 'E' : 'W'}
        </div>
      )}
    </div>
  )
}
