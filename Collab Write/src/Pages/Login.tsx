import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useToast } from "../Context/ToastContext";

const Login = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  useEffect(() => {
    if (localStorage.getItem("isLoggedIn")) {
      navigate("/");
    }
  }, [navigate]);

  const [inputValue, setInputValue] = useState({ email: "", password: "" });
  const { email, password } = inputValue;
  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInputValue({ ...inputValue, [name]: value });
  };

  const handleError = (err: string) => addToast(err, "error");
  const handleSuccess = (msg: string) => addToast(msg, "success");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/login`, { ...inputValue }, { withCredentials: true });
      const { success, message } = data;
      if (success) {
        handleSuccess(message);
        localStorage.setItem("isLoggedIn", "true");
        setTimeout(() => {
          navigate("/");
        }, 200);
      }
      else { handleError(message); }
    } catch (error) { console.log(error); }
    setInputValue({ ...inputValue, email: "", password: "" });
  };

  return (
    <div className="min-h-screen flex bg-[var(--surface)] text-[var(--on-surface)]">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-[var(--surface-container-low)] border-r border-[var(--outline-variant)] flex-col justify-between p-12">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--primary)]">Collab Write</h1>
        </div>
        <div>
          <p className="text-4xl font-extrabold leading-snug max-w-md tracking-tight">
            Write together,<br />in real time.
          </p>
          <p className="mt-4 text-[var(--on-surface-variant)] text-lg max-w-sm">
            A collaborative document editor for teams. No fuss, just writing.
          </p>
        </div>
        <p className="text-xs font-mono text-[var(--outline)]">v1.0.2</p>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8">
            <h1 className="text-xl font-bold text-[var(--primary)]">Collab Write</h1>
          </div>

          <h2 className="text-3xl font-bold mb-2">Log in</h2>
          <p className="text-[var(--on-surface-variant)] mb-8">Enter your credentials to continue.</p>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--on-surface-variant)] mb-1.5" htmlFor="email">Email</label>
              <input
                type="email" name="email" id="email" value={email}
                placeholder="you@example.com" onChange={handleOnChange}
                className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--outline-variant)] rounded-md text-[var(--on-surface)] placeholder-[var(--outline)] focus:outline-none focus:border-[var(--secondary-container)] focus:ring-1 focus:ring-[var(--secondary-container)] transition-all"
                autoComplete="email" required
              />
            </div>
            <div className="mb-8">
              <label className="block text-sm font-medium text-[var(--on-surface-variant)] mb-1.5" htmlFor="password">Password</label>
              <input
                type="password" name="password" id="password" value={password}
                placeholder="Your password" onChange={handleOnChange}
                className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--outline-variant)] rounded-md text-[var(--on-surface)] placeholder-[var(--outline)] focus:outline-none focus:border-[var(--secondary-container)] focus:ring-1 focus:ring-[var(--secondary-container)] transition-all"
                autoComplete="current-password" required
              />
            </div>
            <button type="submit" className="w-full py-3 bg-gradient-to-br from-[var(--primary)] to-[var(--primary-container)] text-[var(--on-primary)] text-sm font-bold rounded-md hover:shadow-[0_0_15px_var(--primary)] transition-all">
              Log in
            </button>
          </form>

          <p className="mt-8 text-sm text-[var(--on-surface-variant)] text-center">
            No account?{" "}
            <Link to="/signup" className="text-[var(--secondary-container)] font-semibold hover:underline">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
