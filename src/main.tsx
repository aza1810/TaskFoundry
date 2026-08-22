import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { initNativeOta } from './native/ota'
import { initTheme } from './theme'
import { initAppHeight } from './ui/syncAppHeight'

initTheme()
initAppHeight()
void initNativeOta()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
