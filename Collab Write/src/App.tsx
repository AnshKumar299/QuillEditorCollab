import { Routes, Route } from 'react-router-dom'
import { ToastProvider } from './Context/ToastContext'
import Dashboard from './Pages/Dashboard.tsx'
import Home from './Pages/Home.tsx'
import Login from './Pages/Login.tsx'
import Signup from './Pages/Signup.tsx'
import './App.css'

function App() {
  return (
    <div className="App">
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/edit/:id" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Routes>
      </ToastProvider>
    </div>
  )
}

export default App
