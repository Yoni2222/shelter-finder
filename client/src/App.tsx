import { useState, useCallback } from 'react'
import { useLanguage } from './context/LanguageContext'
import { useShelters } from './hooks/useShelters'
import type { Category, Shelter } from './types/shelter'
import { STRINGS } from './i18n/strings'
import { SearchBar } from './components/SearchBar/SearchBar'
import { CategoryFilter } from './components/Filters/CategoryFilter'
import { ShelterMap } from './components/Map/ShelterMap'
import { Sidebar } from './components/Sidebar/Sidebar'
import { LanguageToggle } from './components/LanguageToggle'

type Status = 'idle' | 'loading' | 'error' | 'success'
type Strings = (typeof STRINGS)['he']

function errorCodeToMsg(code: string, t: Strings): string {
  switch (code) {
    case 'enter_addr':     return t.enterAddr
    case 'addr_not_found': return t.addrNotFound
    case 'busy':           return t.geocodeBusy
    case 'search_err':     return t.geoSearchErr
    case 'geo_denied':     return t.geoDenied
    case 'geo_unavail':    return t.geoUnavail
    case 'geo_timeout':    return t.geoTimeout
    case 'geo_no_geo':     return t.noGeo
    case 'voice_unsupported': return t.voiceUnsupported
    case 'voice_denied':   return t.voiceDenied
    case 'voice_no_speech': return t.voiceNoSpeech
    case 'voice_error':    return t.voiceError
    default:               return t.geoErr
  }
}

export default function App() {
  const { t } = useLanguage()

  const [userPos, setUserPos]   = useState<{ lat: number; lon: number } | null>(null)
  const [radiusM, setRadiusM]   = useState(2000)
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(
    new Set<Category>(['public', 'school', 'parking']),
  )
  const [activeId,  setActiveId]  = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [flyToPos,  setFlyToPos]  = useState<[number, number] | null>(null)
  const [searching, setSearching] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)

  const {
    data,
    isLoading: sheltersLoading,
    isError,
    error: shelterError,
  } = useShelters(userPos?.lat ?? null, userPos?.lon ?? null, radiusM, searchQuery)

  const allShelters      = data?.shelters ?? []
  const filteredShelters = allShelters.filter(s => activeCategories.has(s.category))

  // Derive sidebar status from all async states
  const status: Status =
    searching          ? 'loading' :
    errorCode !== null ? 'error'   :
    userPos === null   ? 'idle'    :
    sheltersLoading    ? 'loading' :
    isError            ? 'error'   :
    data !== undefined ? 'success' :
    'idle'

  const displayError = errorCode
    ? errorCodeToMsg(errorCode, t)
    : isError
    ? t.loadErr + ((shelterError as Error)?.message ?? '')
    : null

  // ── Callbacks ──

  const handleLocation = useCallback((lat: number, lon: number, query?: string) => {
    setUserPos({ lat, lon })
    setSearchQuery(query || '')
    setErrorCode(null)
    setSearching(false)
    setActiveId(null)
    setFlyToPos(null)   // FitBounds will auto-fit the view
  }, [])

  const handleError = useCallback((code: string) => {
    setSearching(false)
    setErrorCode(code)
    // Clear previous results so stale shelters don't show behind the error
    setUserPos(null)
    setSearchQuery('')
  }, [])

  const handleSearchStart = useCallback(() => {
    setSearching(true)
    setErrorCode(null)
    setActiveId(null)
  }, [])

  const handleRadiusChange = useCallback((r: number) => {
    setRadiusM(r)
  }, [])

  const handleMapClick = useCallback((lat: number, lon: number) => {
    setUserPos({ lat, lon })
    setSearchQuery('')
    setErrorCode(null)
    setSearching(false)
    setActiveId(null)
    setFlyToPos(null)
  }, [])

  const handleMarkerClick = useCallback((idx: number) => {
    const shelter = filteredShelters[idx]
    if (!shelter) return
    setActiveId(shelter.id)
    setFlyToPos([shelter.lat, shelter.lon])
  }, [filteredShelters])

  const handleSelectShelter = useCallback((s: Shelter) => {
    setActiveId(s.id)
    setFlyToPos([s.lat, s.lon])
  }, [])

  return (
    <>
      <header>
        <div className="hdr-icon">🏚️</div>
        <div className="hdr-text">
          <h1>{t.appTitle}</h1>
          <p>{t.appSubtitle}</p>
        </div>
        <div className="hdr-right">
          <span className="hdr-badge">{t.hdrBadge}</span>
          <LanguageToggle />
        </div>
      </header>

      <SearchBar
        radiusM={radiusM}
        onRadiusChange={handleRadiusChange}
        onLocation={handleLocation}
        onError={handleError}
        onSearchStart={handleSearchStart}
      />

      <CategoryFilter
        active={activeCategories}
        onChange={setActiveCategories}
      />

      <div className="main">
        <ShelterMap
          userPos={userPos}
          shelters={filteredShelters}
          radiusM={radiusM}
          activeId={activeId}
          flyToPos={flyToPos}
          onMapClick={handleMapClick}
          onMarkerClick={handleMarkerClick}
        />
        <Sidebar
          shelters={allShelters}
          filteredShelters={filteredShelters}
          activeId={activeId}
          radiusM={radiusM}
          sources={data?.sources ?? {}}
          status={status}
          errorMsg={displayError}
          municipalityLink={data?.sources?.municipalityListLink}
          onSelectShelter={handleSelectShelter}
        />
      </div>
    </>
  )
}
