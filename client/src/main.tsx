import { StrictMode } from 'react'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LanguageProvider } from './context/LanguageContext'
import App from './App'
import './styles/global.css'

// On iOS the WKWebView covers the whole screen, including the status bar,
// and env(safe-area-inset-top) reports 0 inside Capacitor - so CSS padding
// cannot fix it. Tell the native layer to inset the web view instead, which
// is what Android already does by default.
if (Capacitor.getPlatform() === 'ios') {
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {})
  // Light glyphs, because the header behind them is dark navy.
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </QueryClientProvider>
  </StrictMode>,
)
