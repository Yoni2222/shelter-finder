import { useRef, useState, useEffect, useCallback } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { geocodeAddress, useAutocomplete } from '../../hooks/useGeocode'
import { useGeolocation } from '../../hooks/useGeolocation'
import { useVoiceSearch } from '../../hooks/useVoiceSearch'
import type { GeocodeResult } from '../../types/shelter'

interface Props {
  radiusM:       number
  onRadiusChange: (r: number) => void
  onLocation:    (lat: number, lon: number, query?: string) => void
  onError:       (msg: string) => void
  onSearchStart: () => void
}

export function SearchBar({ radiusM, onRadiusChange, onLocation, onError, onSearchStart }: Props) {
  const { t, lang } = useLanguage()
  const [inputVal, setInputVal]   = useState('')
  const [showSug,  setShowSug]    = useState(false)
  const [hlIndex,  setHlIndex]    = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)

  const { suggestions, clear: clearSug } = useAutocomplete(showSug ? inputVal : '', lang)

  // Reset highlight when suggestions change
  useEffect(() => { setHlIndex(-1) }, [suggestions])

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
    onLocation(+item.lat, +item.lon, item.display_name)
  }

  const doSearch = async () => {
    const q = inputVal.trim()
    if (!q) { onError('enter_addr'); return }
    setShowSug(false)
    onSearchStart()
    try {
      const results = await geocodeAddress(q, lang)
      if (!results.length) { onError('addr_not_found'); return }
      onLocation(+results[0].lat, +results[0].lon, q)
    } catch (e: unknown) {
      onError(e instanceof Error && e.message === '__busy__' ? 'busy' : 'search_err')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSug || suggestions.length === 0) {
      if (e.key === 'Enter') doSearch()
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHlIndex(prev => (prev + 1) % suggestions.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setHlIndex(prev => (prev <= 0 ? suggestions.length - 1 : prev - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (hlIndex >= 0 && hlIndex < suggestions.length) {
          pickSuggestion(suggestions[hlIndex])
        } else {
          doSearch()
        }
        break
      case 'Escape':
        setShowSug(false)
        break
    }
  }

  const handleVoiceResult = useCallback((text: string) => {
    setInputVal(text)
    // Auto-search after voice input
    setShowSug(false)
    onSearchStart()
    geocodeAddress(text, lang).then(results => {
      if (!results.length) { onError('addr_not_found'); return }
      onLocation(+results[0].lat, +results[0].lon, text)
    }).catch((e: unknown) => {
      onError(e instanceof Error && e.message === '__busy__' ? 'busy' : 'search_err')
    })
  }, [lang, onSearchStart, onLocation, onError])

  const handleVoiceError = useCallback((code: string) => {
    onError(code)
  }, [onError])

  const voice = useVoiceSearch(lang, handleVoiceResult, handleVoiceError)

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
          key={lang}
          type="text"
          className={`search-input ${lang === 'en' ? 'search-input-ltr' : ''}`}
          placeholder={t.searchPlaceholder}
          value={inputVal}
          dir={lang === 'he' ? 'rtl' : 'ltr'}
          autoComplete="off"
          onChange={e => { setInputVal(e.target.value); setShowSug(true) }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSug(true)}
          role="combobox"
          aria-expanded={showSug && suggestions.length > 0}
          aria-autocomplete="list"
          aria-activedescendant={hlIndex >= 0 ? `sug-${hlIndex}` : undefined}
        />
        {showSug && suggestions.length > 0 && (
          <div className="suggestions" role="listbox">
            {suggestions.map((s, i) => (
              <div
                key={i}
                id={`sug-${i}`}
                className={`sug-item${i === hlIndex ? ' sug-active' : ''}`}
                role="option"
                aria-selected={i === hlIndex}
                onClick={() => pickSuggestion(s)}
                onMouseEnter={() => setHlIndex(i)}
              >
                {s.display_name}
              </div>
            ))}
          </div>
        )}
      </div>

      {voice.supported && (
        <button
          className={`btn btn-mic${voice.listening ? ' listening' : ''}`}
          onClick={voice.listening ? voice.stop : voice.start}
          title={voice.listening ? t.voiceListening : t.voiceTooltip}
        >
          <span>{voice.listening ? '⏹️' : '🎙️'}</span>
        </button>
      )}

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
