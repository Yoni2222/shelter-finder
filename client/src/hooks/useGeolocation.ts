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
      // High-accuracy timed out → retry with low accuracy (cell/wifi, much faster)
      if (err.code === 3) {
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          fallbackErr => {
            setState({ loading: false, error: String(fallbackErr.code) })
            const codes: Record<number, string> = { 1: 'denied', 2: 'unavail', 3: 'timeout' }
            onError(codes[fallbackErr.code] ?? 'error')
          },
          { timeout: 10_000, maximumAge: 300_000, enableHighAccuracy: false },
        )
        return
      }
      setState({ loading: false, error: String(err.code) })
      const codes: Record<number, string> = { 1: 'denied', 2: 'unavail', 3: 'timeout' }
      onError(codes[err.code] ?? 'error')
    }

    // High accuracy (GPS) with short timeout; falls back to cell/WiFi if GPS is slow
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      { timeout: 8_000, maximumAge: 60_000, enableHighAccuracy: true },
    )
  }

  return { ...state, request }
}
