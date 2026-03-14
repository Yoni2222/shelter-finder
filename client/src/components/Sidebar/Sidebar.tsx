import { useEffect, useRef } from 'react'
import type { Shelter } from '../../types/shelter'
import { useLanguage } from '../../context/LanguageContext'
import { ShelterCard } from './ShelterCard'

interface Props {
  shelters:           Shelter[]
  filteredShelters:   Shelter[]
  activeId:           string | null
  radiusM:            number
  sources:            Record<string, unknown>
  status:             'idle' | 'loading' | 'error' | 'success'
  errorMsg:           string | null
  municipalityLink:   { url: string; label?: string; city: string } | null | undefined
  onSelectShelter:    (s: Shelter, rank: number) => void
}

export function Sidebar({
  filteredShelters,
  activeId,
  radiusM,
  sources,
  status,
  errorMsg,
  municipalityLink,
  onSelectShelter,
}: Props) {
  const { t } = useLanguage()
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Scroll active card into view
  useEffect(() => {
    if (activeId && cardRefs.current[activeId]) {
      cardRefs.current[activeId]!.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeId])

  const radiusLabel = t.radiusOpts.find(([v]) => +v.trim() === radiusM)?.[1] ?? `${radiusM}m`

  const headerTitle = () => {
    if (status === 'idle')    return t.sidebarTitle
    if (status === 'loading') return t.sidebarSub
    return t.foundX(filteredShelters.length)
  }

  const headerSub = () => {
    if (status === 'idle' || status === 'loading') return ''
    const cats: string[] = []
    if ((sources.public  as number) > 0) cats.push(`🏚️ ${sources.public}`)
    if ((sources.school  as number) > 0) cats.push(`🏫 ${sources.school}`)
    if ((sources.parking as number) > 0) cats.push(`🅿️ ${sources.parking}`)
    return t.inRadius(radiusLabel) + (cats.length ? ' · ' + cats.join(' · ') : '')
  }

  const renderList = () => {
    if (status === 'idle') {
      return (
        <div className="state">
          <div className="state-icon">🗺️</div>
          <div className="state-title">{t.emptyTitle}</div>
          <div className="state-sub">{t.emptySub}</div>
        </div>
      )
    }
    if (status === 'loading') {
      return (
        <div className="loading">
          <div className="spinner" />
          <div className="loading-txt">{t.searchingAddr}</div>
        </div>
      )
    }
    if (status === 'error' && errorMsg) {
      return <div className="err-box">{errorMsg}</div>
    }
    if (!filteredShelters.length) {
      return (
        <div className="state">
          <div className="state-icon">🔍</div>
          <div className="state-title">{t.noResults}</div>
          <div className="state-sub">{t.noResultsSub}</div>
        </div>
      )
    }
    return filteredShelters.map((s, i) => (
      <div key={s.id} ref={el => { cardRefs.current[s.id] = el }}>
        <ShelterCard
          shelter={s}
          rank={i + 1}
          isActive={s.id === activeId}
          onClick={onSelectShelter}
        />
      </div>
    ))
  }

  return (
    <div className="sidebar">
      <div className="sidebar-hdr">
        <h2>{headerTitle()}</h2>
        {headerSub() && <div className="sub">{headerSub()}</div>}
        {municipalityLink?.url && (
          <a
            href={municipalityLink.url}
            target="_blank"
            rel="noopener"
            className="municipality-link"
          >
            📋 {municipalityLink.label || municipalityLink.city}{t.municipalityListLink}
          </a>
        )}
      </div>
      <div className="shelter-list">
        {renderList()}
      </div>
      <div className="disclaimer">{t.disclaimer}</div>
    </div>
  )
}
