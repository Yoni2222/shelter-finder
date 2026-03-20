import { useEffect } from 'react'
import {
  MapContainer, TileLayer, Marker, Popup, Circle, useMap,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Shelter } from '../../types/shelter'
import { useLanguage } from '../../context/LanguageContext'
import { localizeName } from '../../i18n/strings'

// ── Fix Leaflet's broken default icon paths in Vite ──
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Map controller: fly to a position imperatively ──
function FlyTo({ pos }: { pos: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (pos) map.setView(pos, 17)
  }, [pos, map])
  return null
}

// ── Fit map to include user + nearby shelters ──
function FitBounds({ userPos, shelters }: { userPos: [number, number]; shelters: Shelter[] }) {
  const map = useMap()
  useEffect(() => {
    const bounds = L.latLngBounds([userPos])
    shelters.slice(0, 20).forEach(s => bounds.extend([s.lat, s.lon]))
    map.fitBounds(bounds.pad(0.12), { maxZoom: 16 })
  }, [userPos, shelters, map]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// ── Colour-coded numbered circle icon ──
function makeIcon(color: string, label: number) {
  return L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;background:${color};color:#fff;border-radius:50%;
           display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;
           box-shadow:0 2px 6px rgba(0,0,0,.35);border:2px solid #fff;">${label}</div>`,
    iconSize:   [26, 26],
    iconAnchor: [13, 13],
  })
}

function markerColor(s: Shelter): string {
  if (s.category === 'school')  return '#7c3aed'
  if (s.category === 'parking') return '#ea580c'
  return s.dist < 0.5 ? '#16a34a' : s.dist < 2 ? '#d97706' : '#64748b'
}

const userIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;background:#ef4444;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>',
  iconSize:   [16, 16],
  iconAnchor: [8, 8],
})

interface Props {
  userPos:    { lat: number; lon: number } | null
  shelters:   Shelter[]
  radiusM:    number
  activeId:   string | null
  flyToPos:   [number, number] | null
  onMapClick: (lat: number, lon: number) => void
  onMarkerClick: (shelterIdx: number) => void
}

export function ShelterMap({
  userPos, shelters, radiusM, flyToPos, onMapClick, onMarkerClick,
}: Props) {
  const { t, lang } = useLanguage()
  const center: [number, number] = userPos
    ? [userPos.lat, userPos.lon]
    : [31.7683, 35.2137]  // Jerusalem as default

  return (
    <MapContainer
      center={center}
      zoom={userPos ? 14 : 7}
      className="map-container"
      style={{ width: '100%' }}
      attributionControl={false}
    >
      <TileLayer
        key={lang}
        url={lang === 'en'
          ? 'https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
        maxZoom={19}
        attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      {/* Click on map to set user location */}
      <MapClickHandler onMapClick={onMapClick} />
      <MobileZoomFix />

      {/* Imperative fly-to when card is selected */}
      <FlyTo pos={flyToPos} />

      {/* Auto-fit when new results arrive */}
      {userPos && shelters.length > 0 && (
        <FitBounds
          userPos={[userPos.lat, userPos.lon]}
          shelters={shelters}
        />
      )}

      {/* Search radius ring */}
      {userPos && (
        <Circle
          center={[userPos.lat, userPos.lon]}
          radius={radiusM}
          pathOptions={{
            color: '#2563eb', fillColor: '#2563eb',
            fillOpacity: 0.05, weight: 1.5,
            dashArray: '6,5',
          }}
        />
      )}

      {/* User location marker */}
      {userPos && (
        <Marker position={[userPos.lat, userPos.lon]} icon={userIcon}>
          <Popup>{t.myLocation}</Popup>
        </Marker>
      )}

      {/* Shelter markers */}
      {shelters.slice(0, 150).map((s, i) => {
        const addr = lang === 'en' && s.addressEn
          ? s.addressEn
          : [s.address, s.city].filter(Boolean).join(', ')
        return (
          <Marker
            key={s.id}
            position={[s.lat, s.lon]}
            icon={makeIcon(markerColor(s), i + 1)}
            eventHandlers={{ click: () => onMarkerClick(i) }}
          >
            <Popup>
              <div dir={lang === 'he' ? 'rtl' : 'ltr'}>
                <b>{localizeName(s.name, lang, s.addressEn)}</b>
                {addr && <><br />{addr}</>}
                <br /><b>{t.popupDist} {t.distFmt(s.dist)}</b>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}


// ── Fix tile gaps on mobile pinch-zoom ──
function MobileZoomFix() {
  const map = useMap()
  useEffect(() => {
    const fix = () => { setTimeout(() => map.invalidateSize(), 100) }
    map.on('zoomend', fix)
    map.on('moveend', fix)
    return () => { map.off('zoomend', fix); map.off('moveend', fix) }
  }, [map])
  return null
}
// Click handler component (needs useMap — must live inside MapContainer)
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  const map = useMap()
  useEffect(() => {
    const handler = (e: L.LeafletMouseEvent) => onMapClick(e.latlng.lat, e.latlng.lng)
    map.on('click', handler)
    return () => { map.off('click', handler) }
  }, [map, onMapClick])
  return null
}
