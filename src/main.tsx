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

// iPhone ana ekran uygulaması ilk açılışta görünüm yüksekliğini kısa ölçüyor ve altta boşluk kalıyor.
// Orada uygulama her zaman tam ekran olduğu için yükseklik doğrudan ekranın yüksekliğinden alınır.
const iosStandalone =
  /iPhone|iPod/.test(navigator.userAgent) && ((navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches)
const fitHeight = () => {
  const h = iosStandalone ? Math.max(screen.height, innerHeight) : innerHeight
  document.documentElement.style.setProperty('--app-h', `${h}px`)
}
fitHeight()
addEventListener('resize', fitHeight)
addEventListener('orientationchange', () => setTimeout(fitHeight, 300))
addEventListener('pageshow', fitHeight)

// Tarayıcının fotoğrafları depolama temizliğinde silmemesini ister.
navigator.storage?.persist?.().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
