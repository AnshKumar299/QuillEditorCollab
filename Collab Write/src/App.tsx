import { Routes, Route } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import Dashboard from './Pages/Dashboard.tsx'
import Home from './Pages/Home.tsx'
import Login from './Pages/Login.tsx'
import Signup from './Pages/Signup.tsx'
import './App.css'

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/edit/:id" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  )
}

export default App
