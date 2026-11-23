import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './theme.css' // shared look & feel (visual only) - keep AFTER the page stylesheets
import './dark-theme.css' // dark mode + text size / density settings - keep AFTER theme.css
import { initSettings } from './utils/appSettings.js'
import './config/axiosConfig.js'

initSettings() // apply saved theme before the first paint

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)