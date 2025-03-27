import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/360t-theme.css'
import './index.css'
import './styles/override.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
