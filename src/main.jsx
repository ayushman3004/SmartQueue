import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider, AuthContext } from './context/AuthContext.jsx'
import { SocketProvider } from './context/SocketContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AuthContext.Consumer>
          {({ setUser }) => (
            <SocketProvider setUser={setUser}>
              <App />
            </SocketProvider>
          )}
        </AuthContext.Consumer>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
