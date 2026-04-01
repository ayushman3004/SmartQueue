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
          {({ setUser, user }) => (
            <SocketProvider setUser={setUser} user={user}>
              <App />
            </SocketProvider>
          )}
        </AuthContext.Consumer>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
