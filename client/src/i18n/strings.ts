export type Lang = 'he' | 'en'

interface Strings {
  dir:                 string
  lang:                string
  appTitle:            string
  appSubtitle:         string
  hdrBadge:            string
  searchPlaceholder:   string
  searchBtn:           string
  gpsBtn:              string
  radiusLabel:         string
  radiusOpts:          [string, string][]
  catLabel:            string
  catPublic:           string
  catSchool:           string
  catParking:          string
  catNote:             string
  sidebarTitle:        string
  sidebarSub:          string
  emptyTitle:          string
  emptySub:            string
  noResults:           string
  noResultsSub:        string
  foundX:              (n: number) => string
  inRadius:            (r: string) => string
  govLabel:            (n: number) => string
  osmLabel:            (n: number) => string
  myLocation:          string
  gpsDetected:         string
  detectingGPS:        string
  detecting:           string
  searchingAddr:       string
  searchingFmt:        (r: string) => string
  addrNotFound:        string
  noGeo:               string
  geoDenied:           string
  geoUnavail:          string
  geoTimeout:          string
  geoErr:              string
  enterAddr:           string
  loadErr:             string
  geoSearchErr:        string
  geocodeBusy:         string
  distFmt:             (km: number) => string
  popupDist:           string
  govBadge:            string
  arcgisBadge:         string
  osmBadge:            string
  schoolBadge:         string
  parkingBadge:        string
  wazeLabel:           string
  gmapsLabel:          string
  municipalityListLink: string
}

export const STRINGS: Record<Lang, Strings> = {
  he: {
    dir: 'rtl', lang: 'he',
    appTitle:       'מאתר מקלטים ציבוריים',
    appSubtitle:    'הכנס כתובת או השתמש ב-GPS לאיתור מקלטים קרובים',
    hdrBadge:       '🛡️ OSM · gov.il · ארצי',
    searchPlaceholder: 'הכנס כתובת (למשל: שדרות רוטשילד 1, תל אביב)…',
    searchBtn:      'חפש',
    gpsBtn:         'מיקום נוכחי',
    radiusLabel:    'טווח:',
    radiusOpts:     [['500',"500 מ'"],[' 1000','1 ק"מ'],['2000','2 ק"מ'],['5000','5 ק"מ'],['10000','10 ק"מ']],
    catLabel:       'הצג:',
    catPublic:      'מקלטים',
    catSchool:      'בתי ספר',
    catParking:     'חניונים',
    catNote:        '🏫 ו-🅿️ — מרחבים מוגנים פוטנציאליים',
    sidebarTitle:   'המקלטים הקרובים אליך',
    sidebarSub:     'הכנס כתובת או לחץ "מיקום נוכחי"',
    emptyTitle:     'טרם בוצע חיפוש',
    emptySub:       'הכנס כתובת בשדה למעלה\nאו לחץ על "מיקום נוכחי"',
    noResults:      'לא נמצאו תוצאות בטווח זה',
    noResultsSub:   'נסה להגדיל את טווח החיפוש\nאו לבדוק כתובת אחרת',
    foundX:     n   => `נמצאו ${n} תוצאות`,
    inRadius:   r   => `בטווח ${r}`,
    govLabel:   n   => `${n} ממסד ממשלתי`,
    osmLabel:   n   => `${n} מ-OSM`,
    myLocation:     '📍 מיקומך',
    gpsDetected:    '📍 מיקום GPS זוהה',
    detectingGPS:   '⏳',
    detecting:      'מזהה…',
    searchingAddr:  'מחפש כתובת…',
    searchingFmt:   r => `מחפש בטווח ${r}…`,
    addrNotFound:   'הכתובת לא נמצאה - נסה להיות יותר מפורט (עיר + רחוב + מספר)',
    noGeo:          'הדפדפן אינו תומך בזיהוי מיקום',
    geoDenied:      'גישה נדחתה – אשר גישה למיקום בדפדפן',
    geoUnavail:     'המיקום אינו זמין',
    geoTimeout:     'פסק זמן',
    geoErr:         'שגיאה בזיהוי מיקום',
    enterAddr:      'אנא הכנס כתובת לחיפוש',
    loadErr:        'שגיאה בטעינת נתונים: ',
    geoSearchErr:   'שגיאת חיפוש: ',
    geocodeBusy:    'שירות החיפוש עמוס כרגע — נסה שוב בעוד שנייה',
    distFmt:   km   => km < 1 ? `${Math.round(km * 1000)} מ'` : `${km.toFixed(1)} ק"מ`,
    popupDist:      'מרחק:',
    govBadge:       '🏛️ gov.il',
    arcgisBadge:    '🏛️ ארצי',
    osmBadge:       '🗺️ OSM',
    schoolBadge:    '🏫 בית ספר',
    parkingBadge:   '🅿️ חניון',
    wazeLabel:      '🗺️ Waze',
    gmapsLabel:     '📍 Google Maps',
    municipalityListLink: ' - רשימה רשמית',
  },
  en: {
    dir: 'ltr', lang: 'en',
    appTitle:       'Public Shelter Finder',
    appSubtitle:    'Enter an address or use GPS to find nearby shelters',
    hdrBadge:       '🛡️ OSM · gov.il · National DB',
    searchPlaceholder: 'Enter address (e.g. 1 Rothschild Blvd, Tel Aviv)…',
    searchBtn:      'Search',
    gpsBtn:         'My Location',
    radiusLabel:    'Radius:',
    radiusOpts:     [['500','500 m'],['1000','1 km'],['2000','2 km'],['5000','5 km'],['10000','10 km']],
    catLabel:       'Show:',
    catPublic:      'Shelters',
    catSchool:      'Schools',
    catParking:     'Parking',
    catNote:        '🏫 & 🅿️ — potential protected spaces',
    sidebarTitle:   'Nearest Results',
    sidebarSub:     'Enter an address or click "My Location"',
    emptyTitle:     'No search yet',
    emptySub:       'Enter an address above\nor click "My Location"',
    noResults:      'No results found in this range',
    noResultsSub:   'Try increasing the search radius\nor check a different address',
    foundX:     n   => `Found ${n} result${n !== 1 ? 's' : ''}`,
    inRadius:   r   => `within ${r}`,
    govLabel:   n   => `${n} from gov database`,
    osmLabel:   n   => `${n} from OSM`,
    myLocation:     '📍 Your location',
    gpsDetected:    '📍 GPS location detected',
    detectingGPS:   '⏳',
    detecting:      'Detecting…',
    searchingAddr:  'Searching address…',
    searchingFmt:   r => `Searching within ${r}…`,
    addrNotFound:   'Address not found - try to be more specific (city + street + number)',
    noGeo:          'Your browser does not support geolocation',
    geoDenied:      'Access denied - allow location access in your browser',
    geoUnavail:     'Location unavailable',
    geoTimeout:     'Location timeout',
    geoErr:         'Error detecting location',
    enterAddr:      'Please enter an address to search',
    loadErr:        'Error loading data: ',
    geoSearchErr:   'Search error: ',
    geocodeBusy:    'Search service is busy — please try again in a second',
    distFmt:   km   => km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`,
    popupDist:      'Distance:',
    govBadge:       '🏛️ gov.il',
    arcgisBadge:    '🏛️ National',
    osmBadge:       '🗺️ OSM',
    schoolBadge:    '🏫 School',
    parkingBadge:   '🅿️ Parking',
    wazeLabel:      '🗺️ Waze',
    gmapsLabel:     '📍 Google Maps',
    municipalityListLink: ' - Official list',
  },
}

// HE → EN name localization (used when lang = 'en')
const HE_EN: Record<string, string> = {
  'מקלט ציבורי':           'Public Shelter',
  'מקלט פצצות':            'Bomb Shelter',
  'מקלט חירום':            'Emergency Shelter',
  'מקלט בית ספרי':         'School Shelter',
  'בית ספר - מתקן קליטה': 'School (Reception Facility)',
  'מרחב מוגן':             'Protected Space',
  'מרחב מוגן דירתי':       'Residential Safe Room',
  'מיגונית':               'Safe Room',
  'גן ילדים':              'Kindergarten',
  'בית ספר':               'School',
  'חניון קומות':           'Multi-storey Parking',
  'חניון מקורה':           'Covered Parking',
  'חניון מחסה לציבור':     'Public Parking Shelter',
  'חניון תת-קרקעי':        'Underground Parking',
  'מקלט בשטח חניון':       'Parking Lot Shelter',
  'מקלט':                  'Shelter',
}

export function localizeName(name: string, lang: Lang): string {
  if (lang !== 'en' || !name) return name
  if (HE_EN[name]) return HE_EN[name]
  if (name.startsWith('מקלט - '))         return 'Shelter - '           + name.slice('מקלט - '.length)
  if (name.startsWith('מקלט חיפה - '))    return 'Haifa Shelter = '     + name.slice('מקלט חיפה - '.length)
  if (name.startsWith('מקלט חיפה #'))     return 'Haifa Shelter #'      + name.slice('מקלט חיפה #'.length)
  if (name.startsWith('מקלט ת"א #'))      return 'Tel Aviv Shelter #'   + name.slice('מקלט ת"א #'.length)
  if (name.startsWith('מקלט ירושלים #'))  return 'Jerusalem Shelter #'  + name.slice('מקלט ירושלים #'.length)
  if (name.startsWith('מקלט באר שבע #'))  return 'Beer Sheva Shelter #' + name.slice('מקלט באר שבע #'.length)
  if (name.startsWith('מקלט '))           return 'Shelter '             + name.slice('מקלט '.length)
  if (name.startsWith('מרחב מוגן '))      return 'Protected Space '     + name.slice('מרחב מוגן '.length)
  if (name.startsWith('בית ספר '))        return 'School '              + name.slice('בית ספר '.length)
  if (name.startsWith('בית-ספר '))        return 'School '              + name.slice('בית-ספר '.length)
  if (name.startsWith('גן ילדים '))       return 'Kindergarten '        + name.slice('גן ילדים '.length)
  if (name.startsWith('גן '))             return 'Kindergarten '        + name.slice('גן '.length)
  if (name.startsWith('חניון '))          return 'Parking '             + name.slice('חניון '.length)
  if (name.startsWith('חנייה '))          return 'Parking '             + name.slice('חנייה '.length)
  return name
}
