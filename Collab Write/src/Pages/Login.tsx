import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { useCookies } from "react-cookie";

const Login = () => {
  const navigate = useNavigate();
  const [cookies] = useCookies(["token"]);

  useEffect(() => {
    if (cookies.token) {
      navigate("/");
    }
  }, [cookies.token, navigate]);

  const [inputValue, setInputValue] = useState({ email: "", password: "" });
  const { email, password } = inputValue;
  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInputValue({ ...inputValue, [name]: value });
  };

  const handleError = (err: string) => toast.error(err, { position: "top-right" });
  const handleSuccess = (msg: string) => toast.success(msg, { position: "top-right", toastId: "loginSuccess" });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const { data } = await axios.post("http://localhost:3000/login", { ...inputValue }, { withCredentials: true });
      const { success, message } = data;
      if (success) { handleSuccess(message); navigate("/"); }
      else { handleError(message); }
    } catch (error) { console.log(error); }
    setInputValue({ ...inputValue, email: "", password: "" });
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#1a1a2e] text-white flex-col justify-between p-12">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Collab Write</h1>
        </div>
        <div>
          <p className="text-3xl font-semibold leading-snug max-w-md">
            Write together,<br />in real time.
          </p>
          <p className="mt-4 text-[#8888a8] text-sm max-w-sm">
            A collaborative document editor for teams. No fuss, just writing.
          </p>
        </div>
        <p className="text-xs text-[#555570]">v1.0.2</p>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-[#f7f7f7]">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8">
            <h1 className="text-xl font-bold text-[#111]">Collab Write</h1>
          </div>

          <h2 className="text-2xl font-semibold text-[#111] mb-1">Log in</h2>
          <p className="text-sm text-[#777] mb-8">Enter your credentials to continue.</p>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-xs font-medium text-[#555] mb-1.5" htmlFor="email">Email</label>
              <input
                type="email" name="email" id="email" value={email}
                placeholder="you@example.com" onChange={handleOnChange}
                className="w-full px-3 py-2 text-sm bg-white border border-[#ddd] rounded-md text-[#111] placeholder-[#aaa] focus:outline-none focus:border-[#111] focus:ring-1 focus:ring-[#111] transition-colors"
                autoComplete="email" required
              />
            </div>
            <div className="mb-6">
              <label className="block text-xs font-medium text-[#555] mb-1.5" htmlFor="password">Password</label>
              <input
                type="password" name="password" id="password" value={password}
                placeholder="Your password" onChange={handleOnChange}
                className="w-full px-3 py-2 text-sm bg-white border border-[#ddd] rounded-md text-[#111] placeholder-[#aaa] focus:outline-none focus:border-[#111] focus:ring-1 focus:ring-[#111] transition-colors"
                autoComplete="current-password" required
              />
            </div>
            <button type="submit" className="w-full py-2 bg-[#111] text-white text-sm font-medium rounded-md hover:bg-[#333] transition-colors">
              Log in
            </button>
          </form>

          <p className="mt-6 text-sm text-[#888]">
            No account?{" "}
            <Link to="/signup" className="text-[#111] font-medium hover:underline">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
