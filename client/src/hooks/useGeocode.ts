import { useCallback, useEffect, useRef, useState } from 'react'
import type { GeocodeResult } from '../types/shelter'
import { getApiBase } from '../config/api'

// Explicit address search (Enter / Search button)
export async function geocodeAddress(q: string, lang = 'he'): Promise<GeocodeResult[]> {
  const r = await fetch(`${getApiBase()}/api/geocode?q=${encodeURIComponent(q)}&lang=${lang}`)
  if (r.status === 503) throw new Error('__busy__')
  if (!r.ok) throw new Error('geocode error ' + r.status)
  return r.json()
}

// Autocomplete suggestions — 600ms debounce
export function useAutocomplete(q: string, lang = 'he') {
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (q.trim().length < 2) { setSuggestions([]); return }

    timerRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`${getApiBase()}/api/geocode?q=${encodeURIComponent(q)}&suggest=1&lang=${lang}`)
        if (r.status === 204 || r.status === 503) { setSuggestions([]); return }
        if (!r.ok) { setSuggestions([]); return }
        const data: GeocodeResult[] = await r.json()
        setSuggestions(data.slice(0, 5))
      } catch {
        setSuggestions([])
      }
    }, 600)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [q])

  const clear = useCallback(() => setSuggestions([]), [])
  return { suggestions, clear }
}
