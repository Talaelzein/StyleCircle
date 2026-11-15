import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_URL, getResponseData } from "../services/api";

// LOGIN AND SIGNUP
export default function AuthPage({ mode, onLogin }) {
  const navigate = useNavigate();
  const isSignup = mode === "signup";

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const body = isSignup
      ? { username, email, password }
      : { email, password };

    try {
      const response = await fetch(
        `${API_URL}/api/auth/${mode}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        }
      );

      const data = await getResponseData(response);

      if (data.token && data.user) {
        onLogin({
          user: data.user,
          token: data.token
        });

        navigate("/wardrobe");
      } else if (isSignup) {
        navigate("/login");
      } else {
        throw new Error(
          "Login response is missing account information"
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <div className="eyebrow">
        YOUR SOCIAL FASHION CLOSET
      </div>

      <h1>
        Style<span>Circle</span>
      </h1>

      <p className="subtitle">
        Your wardrobe, your style, your circle.
      </p>

      <div className="panel">
        <h2>
          {isSignup
            ? "Create your account"
            : "Welcome back"}
        </h2>

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >
          {isSignup && (
            <input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              minLength={2}
              required
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={isSignup ? 8 : 1}
            required
          />

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}>
            {loading
              ? "Please wait..."
              : isSignup
                ? "Sign Up"
                : "Log In"}
          </button>
        </form>

        <p>
          {isSignup
            ? "Already have an account?"
            : "New to StyleCircle?"}
          {" "}
          <Link to={isSignup ? "/login" : "/signup"}>
            {isSignup ? "Log in" : "Sign up"}
          </Link>
        </p>
      </div>
    </main>
  );
}

