import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { login, signup } from "../api";

function BlobBackground() {
  return (
    <svg className="blob-bg" viewBox="0 0 500 700" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="brassGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c98a3e" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#c98a3e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sageGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#6b8f71" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#6b8f71" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="120" cy="150" r="220" fill="url(#brassGlow)" />
      <circle cx="380" cy="520" r="260" fill="url(#sageGlow)" />
      <circle cx="90" cy="620" r="3" fill="#c98a3e" opacity="0.6" />
      <circle cx="410" cy="120" r="2" fill="#ede6d6" opacity="0.4" />
      <circle cx="300" cy="80" r="2" fill="#ede6d6" opacity="0.3" />
    </svg>
  );
}

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { setAuth } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit() {
    setLoading(true);
    setError("");
    try {
      const result = mode === "login" ? await login(email, password) : await signup(email, password);
      setAuth(result.token, result.email);
      navigate("/upload");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="split-screen">
      <div className="brand-panel">
        <BlobBackground />
        <div className="brand-content">
          <div className="logo-mark">
            <svg width="26" height="20" viewBox="0 0 26 20" fill="none">
              <circle cx="9" cy="10" r="8.5" stroke="#ede6d6" strokeWidth="1.4" />
              <circle cx="17" cy="10" r="8.5" stroke="#c98a3e" strokeWidth="1.4" />
            </svg>
            AI Knowledge Assistant
          </div>
          <h1 className="brand-heading">Your own reading room</h1>
          <p className="brand-sub">
            Upload what you're working from, then ask it anything. Answers come only from what
            you've actually given it to read.
          </p>
        </div>
        <p className="brand-footer">Built with Node, MongoDB, S3, and Groq</p>
      </div>

      <div className="form-panel">
        <div className="form-panel-inner">
          <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <div className="auth-form">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password, at least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
            <button className="primary" onClick={handleSubmit} disabled={loading || !email || !password}>
              {loading ? "One moment..." : mode === "login" ? "Log in" : "Create account"}
            </button>
            {error && <p className="error-text">{error}</p>}
          </div>

          <p className="auth-switch">
            {mode === "login" ? "New here? " : "Already have an account? "}
            <button
              className="text-button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
              }}
            >
              {mode === "login" ? "Create one" : "Log in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
