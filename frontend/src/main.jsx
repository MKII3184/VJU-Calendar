import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Chi mot diem vao CSS: app.css = design system VJU (Tailwind v4 + token
// shadcn), va no tu keo styles.css (CSS thu cong cu) vao layer `legacy`.
// KHONG import styles.css o day - import roi no se nam NGOAI layer va de len
// het utility Tailwind. Xem ghi chu thu tu layer trong app.css.
import './app.css'
// Gán class theme lên <html> trước lần render đầu (import có tác dụng phụ).
import './lib/theme'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
