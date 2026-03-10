import { useLanguage } from '../context/LanguageContext'

export function LanguageToggle() {
  const { lang, toggle } = useLanguage()
  return (
    <button className="lang-btn" onClick={toggle}>
      {lang === 'he' ? 'EN' : 'עב'}
    </button>
  )
}
