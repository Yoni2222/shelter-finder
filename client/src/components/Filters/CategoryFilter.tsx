import type { Category } from '../../types/shelter'
import { useLanguage } from '../../context/LanguageContext'

interface Props {
  active:   Set<Category>
  onChange: (cats: Set<Category>) => void
}

export function CategoryFilter({ active, onChange }: Props) {
  const { t } = useLanguage()

  const toggle = (cat: Category) => {
    const next = new Set(active)
    if (next.has(cat)) {
      if (next.size === 1) return  // keep at least one active
      next.delete(cat)
    } else {
      next.add(cat)
    }
    onChange(next)
  }

  return (
    <div className="cat-bar">
      <span className="cat-bar-label">{t.catLabel}</span>

      <button
        className={`cat-btn cat-public${active.has('public') ? ' active' : ''}`}
        title="מקלטים ציבוריים ומרחבים מוגנים"
        onClick={() => toggle('public')}
      >
        <span>🏚️</span><span>{t.catPublic}</span>
      </button>

      <button
        className={`cat-btn cat-school${active.has('school') ? ' active' : ''}`}
        title="בתי ספר וגני ילדים, עשויים לשמש מרחב מוגן"
        onClick={() => toggle('school')}
      >
        <span>🏫</span><span>{t.catSchool}</span>
      </button>

      <button
        className={`cat-btn cat-parking${active.has('parking') ? ' active' : ''}`}
        title="חניונים מקורים ורב-קומתיים, עשויים לשמש מרחב מוגן"
        onClick={() => toggle('parking')}
      >
        <span>🅿️</span><span>{t.catParking}</span>
      </button>

      <span className="cat-note">{t.catNote}</span>
    </div>
  )
}
