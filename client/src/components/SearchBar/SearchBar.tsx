import { useRef, useState, useEffect } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { geocodeAddress, useAutocomplete } from '../../hooks/useGeocode'
import { useGeolocation } from '../../hooks/useGeolocation'
import type { GeocodeResult } from '../../types/shelter'

interface Props {
  radiusM:       number
  onRadiusChange: (r: number) => void
  onLocation:    (lat: number, lon: number) => void
  onError:       (msg: string) => void
  onSearchStart: () => void
}

export function SearchBar({ radiusM, onRadiusChange, onLocation, onError, onSearchStart }: Props) {
  const { t } = useLanguage()
  const [inputVal, setInputVal]   = useState('')
  const [showSug,  setShowSug]    = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const { suggestions, clear: clearSug } = useAutocomplete(showSug ? inputVal : '')

  // Hide suggestions when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowSug(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const pickSuggestion = (item: GeocodeResult) => {
    setInputVal(item.display_name)
    setShowSug(false)
    clearSug()
    onLocation(+item.lat, +item.lon)
  }

  const doSearch = async () => {
    const q = inputVal.trim()
    if (!q) { onError('enter_addr'); return }
    setShowSug(false)
    onSearchStart()
    try {
      const results = await geocodeAddress(q)
      if (!results.length) { onError('addr_not_found'); return }
      onLocation(+results[0].lat, +results[0].lon)
    } catch (e: unknown) {
      onError(e instanceof Error && e.message === '__busy__' ? 'busy' : 'search_err')
    }
  }

  const geoState = useGeolocation(
    (lat, lon) => {
      setInputVal('')
      onLocation(lat, lon)
    },
    (code) => onError('geo_' + code),
  )

  return (
    <div className="search-bar">
      <div className="input-wrap" ref={wrapRef}>
        <span className="search-icon">🔍</span>
        <input
          type="text"
          className="search-input"
          placeholder={t.searchPlaceholder}
          value={inputVal}
          autoComplete="off"
          onChange={e => { setInputVal(e.target.value); setShowSug(true) }}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
          onFocus={() => setShowSug(true)}
        />
        {showSug && suggestions.length > 0 && (
          <div className="suggestions">
            {suggestions.map((s, i) => (
              <div key={i} className="sug-item" onClick={() => pickSuggestion(s)}>
                {s.display_name}
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="btn btn-search" onClick={doSearch}>
        <span>{t.searchBtn}</span>
      </button>

      <button
        className="btn btn-gps"
        disabled={geoState.loading}
        onClick={geoState.request}
      >
        <span>📍</span>
        <span>{geoState.loading ? t.detecting : t.gpsBtn}</span>
      </button>

      <div className="radius-wrap">
        <label>{t.radiusLabel}</label>
        <select
          className="radius-sel"
          value={radiusM}
          onChange={e => onRadiusChange(+e.target.value)}
        >
          {t.radiusOpts.map(([val, label]) => (
            <option key={val} value={val.trim()}>{label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
