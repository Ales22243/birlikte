import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Ana ekrandan açılan iPhone uygulaması arka plandan dönünce sayfayı yeniden yüklemez;
// bu yüzden her öne gelişte ve saatte bir yeni sürümü kendimiz arıyoruz.
if ('serviceWorker' in navigator) {
  const check = () => void navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => {})
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
  setInterval(check, 60 * 60 * 1000)
}

// Tarayıcının fotoğrafları depolama temizliğinde silmemesini ister.
navigator.storage?.persist?.().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
