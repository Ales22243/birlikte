import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Tarayıcının fotoğrafları depolama temizliğinde silmemesini ister.
navigator.storage?.persist?.().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
