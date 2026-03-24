import type { Shelter, Category } from '../../types/shelter'
import { useLanguage } from '../../context/LanguageContext'
import { localizeName } from '../../i18n/strings'

interface Props {
  shelter:  Shelter
  rank:     number
  isActive: boolean
  onClick:  (s: Shelter, rank: number) => void
}

function rankClass(s: Shelter): string {
  if (s.category === 'school')  return 'school'
  if (s.category === 'parking') return 'parking'
  return 'public'
}

export function ShelterCard({ shelter: s, rank, isActive, onClick }: Props) {
  const { t, lang } = useLanguage()
  const cat  = (s.category || 'public') as Category
  const name = localizeName(s.name, lang, s.addressEn)
  const dCls = rankClass(s)
  const addr = lang === 'en' && s.addressEn
    ? s.addressEn
    : [s.address, s.city].filter(Boolean).join(', ')
  const waze  = `https://waze.com/ul?ll=${s.lat},${s.lon}&navigate=yes`
  const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`

  let catBadge: React.ReactNode
  if (cat === 'school') {
    catBadge = <span className="pill pill-school">{t.schoolBadge}</span>
  } else if (cat === 'parking') {
    catBadge = <span className="pill pill-parking">{t.parkingBadge}</span>
  } else {
    const label = s.source === 'arcgis' ? t.arcgisBadge : s.source === 'gov' ? t.govBadge : t.osmBadge
    catBadge = <span className="pill pill-tag">{label}</span>
  }

  const activeClass = isActive
    ? `active${cat === 'school' ? ' cat-school' : cat === 'parking' ? ' cat-parking' : ''}`
    : ''

  return (
    <div
      className={`card cat-${cat} ${activeClass}`}
      onClick={() => onClick(s, rank)}
    >
      <div className={`rank ${dCls}`}>{rank}</div>
      <div className="card-body">
        <div className="card-name" title={name}>{name}</div>
        {addr && <div className="card-addr">📍 {addr}</div>}
        <div className="card-meta">
          <span className="pill pill-dist">
            🚶 {t.distFmt(s.dist)}
          </span>
          {s.capacity && (
            <span className="pill pill-tag">👥 {s.capacity}</span>
          )}
          {catBadge}
        </div>
        <div className="nav-links">
          <a href={waze}  target="_blank" rel="noopener" className="nav-link" onClick={e => e.stopPropagation()}>
            {t.wazeLabel}
          </a>
          <a href={gmaps} target="_blank" rel="noopener" className="nav-link" onClick={e => e.stopPropagation()}>
            {t.gmapsLabel}
          </a>
        </div>
      </div>
    </div>
  )
}
