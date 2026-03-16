import { useState } from 'react'

interface GeoState {
  loading: boolean
  error:   string | null
}

export function useGeolocation(
  onSuccess: (lat: number, lon: number) => void,
  onError:   (msg: string) => void,
) {
  const [state, setState] = useState<GeoState>({ loading: false, error: null })

  const request = () => {
    if (!navigator.geolocation) {
      onError('no_geo')
      return
    }
    setState({ loading: true, error: null })

    const handleSuccess = (pos: GeolocationPosition) => {
      setState({ loading: false, error: null })
      onSuccess(pos.coords.latitude, pos.coords.longitude)
    }

    const handleError = (err: GeolocationPositionError) => {
      setState({ loading: false, error: String(err.code) })
      const codes: Record<number, string> = { 1: 'denied', 2: 'unavail', 3: 'timeout' }
      onError(codes[err.code] ?? 'error')
    }

    // Low accuracy first (cell/WiFi) — fast (~1-2s), good enough for 2km shelter search
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      { timeout: 10_000, maximumAge: 60_000, enableHighAccuracy: false },
    )
  }

  return { ...state, request }
}
