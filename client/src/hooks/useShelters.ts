import { useQuery } from '@tanstack/react-query'
import type { SheltersResponse } from '../types/shelter'

async function fetchShelters(lat: number, lon: number, radiusM: number, q?: string): Promise<SheltersResponse> {
  let url = `/api/shelters?lat=${lat}&lon=${lon}&radius=${radiusM}`
  if (q) url += `&q=${encodeURIComponent(q)}`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

export function useShelters(lat: number | null, lon: number | null, radiusM: number, q?: string) {
  return useQuery({
    queryKey: ['shelters', lat, lon, radiusM, q],
    queryFn:  () => fetchShelters(lat!, lon!, radiusM, q),
    enabled:  lat !== null && lon !== null,
    staleTime: 60_000,  // 1 minute
    retry: 1,
  })
}
