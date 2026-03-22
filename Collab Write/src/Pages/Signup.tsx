import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { useCookies } from "react-cookie";

const Signup = () => {
  const navigate = useNavigate();
  const [cookies] = useCookies(["token"]);

  useEffect(() => {
    if (cookies.token) {
      navigate("/");
    }
  }, [cookies.token, navigate]);

  const [inputValue, setInputValue] = useState({
    email: "",
    password: "",
    username: "",
  });
  const { email, password, username } = inputValue;
  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInputValue({
      ...inputValue,
      [name]: value,
    });
  };

  const handleError = (err: string) =>
    toast.error(err, {
      position: "top-right",
    });
  const handleSuccess = (msg: string) =>
    toast.success(msg, {
      position: "top-right",
      toastId: "signupSuccess"
    });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(
        "http://localhost:3000/signup",
        {
          ...inputValue,
        },
        { withCredentials: true }
      );
      const { success, message } = data;
      if (success) {
        handleSuccess(message);
        navigate("/");
      } else {
        handleError(message);
      }
    } catch (error) {
      console.log(error);
    }
    setInputValue({
      ...inputValue,
      email: "",
      password: "",
      username: "",
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans px-4 sm:px-6 lg:px-8 selection:bg-indigo-100 selection:text-indigo-900">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-sm border border-slate-200">
        <div className="text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl shadow-sm mb-4">
                Q
            </div>
          <h2 className="text-3xl font-extrabold text-slate-900">
            Create an account
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Start collaborating on beautiful documents today.
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="email">Email address</label>
              <input
                type="email"
                name="email"
                value={email}
                placeholder="you@example.com"
                onChange={handleOnChange}
                className="appearance-none relative block w-full px-4 py-3 border border-slate-300 placeholder-slate-400 text-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="username">Username</label>
              <input
                type="text"
                name="username"
                value={username}
                placeholder="johndoe"
                onChange={handleOnChange}
                className="appearance-none relative block w-full px-4 py-3 border border-slate-300 placeholder-slate-400 text-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="password">Password</label>
              <input
                type="password"
                name="password"
                value={password}
                placeholder="••••••••"
                onChange={handleOnChange}
                className="appearance-none relative block w-full px-4 py-3 border border-slate-300 placeholder-slate-400 text-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm transition-all"
            >
              Sign up
            </button>
          </div>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
