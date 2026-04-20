import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// Detect PWA standalone mode and add class for fullscreen experience
if (window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: string }).standalone === 'yes') {
  document.documentElement.classList.add('pwa-installed')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
