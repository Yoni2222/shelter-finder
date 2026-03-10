import { useQuery } from '@tanstack/react-query'
import type { SheltersResponse } from '../types/shelter'

async function fetchShelters(lat: number, lon: number, radiusM: number): Promise<SheltersResponse> {
  const r = await fetch(`/api/shelters?lat=${lat}&lon=${lon}&radius=${radiusM}`)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

export function useShelters(lat: number | null, lon: number | null, radiusM: number) {
  return useQuery({
    queryKey: ['shelters', lat, lon, radiusM],
    queryFn:  () => fetchShelters(lat!, lon!, radiusM),
    enabled:  lat !== null && lon !== null,
    staleTime: 60_000,  // 1 minute
    retry: 1,
  })
}
