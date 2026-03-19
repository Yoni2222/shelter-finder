import { useState, useRef, useCallback, useEffect } from 'react'
import type { Lang } from '../i18n/strings'

interface VoiceSearchState {
  listening: boolean
  supported: boolean
  start: () => void
  stop: () => void
}

// Hebrew number words → digits
const HE_NUMBERS: Record<string, string> = {
  'אפס': '0',
  'אחת': '1', 'אחד': '1',
  'שתיים': '2', 'שניים': '2', 'שתים': '2',
  'שלוש': '3', 'שלושה': '3',
  'ארבע': '4', 'ארבעה': '4',
  'חמש': '5', 'חמישה': '5',
  'שש': '6', 'שישה': '6',
  'שבע': '7', 'שבעה': '7',
  'שמונה': '8',
  'תשע': '9', 'תשעה': '9',
  'עשר': '10', 'עשרה': '10',
  'אחת עשרה': '11', 'אחד עשר': '11',
  'שתים עשרה': '12', 'שנים עשר': '12',
  'שלוש עשרה': '13', 'שלושה עשר': '13',
  'ארבע עשרה': '14', 'ארבעה עשר': '14',
  'חמש עשרה': '15', 'חמישה עשר': '15',
  'שש עשרה': '16', 'שישה עשר': '16',
  'שבע עשרה': '17', 'שבעה עשר': '17',
  'שמונה עשרה': '18', 'שמונה עשר': '18',
  'תשע עשרה': '19', 'תשעה עשר': '19',
  'עשרים': '20',
  'שלושים': '30',
  'ארבעים': '40',
  'חמישים': '50',
  'שישים': '60',
  'שבעים': '70',
  'שמונים': '80',
  'תשעים': '90',
  'מאה': '100',
  'מאתיים': '200',
}

/** Convert Hebrew number words to digits in a transcript */
function hebrewNumbersToDigits(text: string): string {
  let result = text

  // First replace multi-word numbers (e.g. "אחת עשרה") before single words
  const sorted = Object.entries(HE_NUMBERS).sort((a, b) => b[0].length - a[0].length)
  for (const [word, digit] of sorted) {
    result = result.replace(new RegExp(`\\b${word}\\b`, 'g'), digit)
  }

  // Combine compound numbers: "20 3" → "23" (tens + units with space)
  result = result.replace(/\b(\d0)\s+(\d)\b/g, (_m, tens, units) =>
    String(parseInt(tens) + parseInt(units))
  )

  return result
}

export function useVoiceSearch(
  lang: Lang,
  onResult: (text: string) => void,
  onError?: (msg: string) => void,
): VoiceSearchState {
  const [listening, setListening] = useState(false)
  const recRef = useRef<SpeechRecognition | null>(null)

  const supported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  const stop = useCallback(() => {
    recRef.current?.stop()
    setListening(false)
  }, [])

  const start = useCallback(() => {
    if (!supported) { onError?.('voice_unsupported'); return }

    // Stop any existing session
    if (recRef.current) { recRef.current.stop() }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    recRef.current = rec

    // Always Hebrew — Israeli addresses are in Hebrew regardless of UI language
    rec.lang = 'he-IL'
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.continuous = false

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let text = e.results[0]?.[0]?.transcript?.trim()
      setListening(false)
      if (text) {
        // Convert Hebrew number words to digits
        text = hebrewNumbersToDigits(text)
        onResult(text)
      }
    }

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      setListening(false)
      if (e.error === 'not-allowed') onError?.('voice_denied')
      else if (e.error === 'no-speech') onError?.('voice_no_speech')
      else if (e.error !== 'aborted') onError?.('voice_error')
    }

    rec.onend = () => setListening(false)

    rec.start()
    setListening(true)
  }, [supported, lang, onResult, onError])

  // Cleanup on unmount
  useEffect(() => {
    return () => { recRef.current?.stop() }
  }, [])

  return { listening, supported, start, stop }
}
