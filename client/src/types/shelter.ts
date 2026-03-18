export type Category = 'public' | 'school' | 'parking'
export type Source   = 'osm' | 'gov' | 'arcgis'

export interface Shelter {
  id:        string
  lat:       number
  lon:       number
  name:      string
  address:   string
  city:      string
  capacity:  string
  type:      string
  source:    Source
  category:  Category
  dist:      number   // km, added by server
  hours?:    string
  addressEn?: string
}

export interface SheltersResponse {
  shelters: Shelter[]
  total:    number
  radius:   number
  sources:  {
    osm:    number
    gov:    number
    arcgis: number
    public: number
    school: number
    parking: number
    municipalityListLink?: { url: string; label?: string; city: string } | null
    osmError?:        string | null
    govError?:        string | null
    arcgisError?:     string | null
    [key: string]:    unknown
  }
}

export interface GeocodeResult {
  lat:          string
  lon:          string
  display_name: string
}
