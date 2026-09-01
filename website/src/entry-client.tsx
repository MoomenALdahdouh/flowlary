import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App.tsx'
import './styles/global.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root')

const tree = (
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)

document.documentElement.classList.add('js')

if (root.firstElementChild) {
  hydrateRoot(root, tree)
} else {
  createRoot(root).render(tree)
}
