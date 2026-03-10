import { createContext, useContext, useEffect, useState } from 'react'
import { STRINGS, type Lang } from '../i18n/strings'

interface LanguageCtx {
  lang:    Lang
  t:       typeof STRINGS['he']
  setLang: (l: Lang) => void
  toggle:  () => void
}

const Ctx = createContext<LanguageCtx | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('he')

  const setLang = (l: Lang) => {
    setLangState(l)
    document.documentElement.dir  = STRINGS[l].dir
    document.documentElement.lang = STRINGS[l].lang
  }

  useEffect(() => {
    // Apply Hebrew RTL on first render
    document.documentElement.dir  = STRINGS[lang].dir
    document.documentElement.lang = STRINGS[lang].lang
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Ctx.Provider value={{
      lang,
      t:      STRINGS[lang],
      setLang,
      toggle: () => setLang(lang === 'he' ? 'en' : 'he'),
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLanguage must be inside LanguageProvider')
  return ctx
}
