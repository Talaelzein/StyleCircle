
import { useEffect, useState } from "react";

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link
} from "react-router-dom";

import { API_URL } from "./services/api";

import AuthPage from "./pages/AuthPage.jsx";
import Wardrobe from "./pages/Wardrobe.jsx";
import OutfitBuilder from "./pages/OutfitBuilder.jsx";
import Suggestions from "./pages/Suggestions.jsx";
import FitCheck from "./pages/FitCheck.jsx";

const SESSION_KEY = "stylecircle_session";

export default function App() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] =
    useState(true);

  // Restore the saved login after refreshing.
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      let savedSession;

      try {
        const saved = sessionStorage.getItem(
          SESSION_KEY
        );

        if (!saved) return;

        savedSession = JSON.parse(saved);

        if (
          !savedSession ||
          typeof savedSession.token !== "string" ||
          !savedSession.token
        ) {
          sessionStorage.removeItem(SESSION_KEY);
          return;
        }
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/api/auth/me`,
          {
            headers: {
              Authorization:
                `Bearer ${savedSession.token}`
            }
          }
        );

        if (response.ok) {
          const data = await response.json();

          if (!cancelled && data.user) {
            setSession({
              token: savedSession.token,
              user: data.user
            });
          }
        } else if (
          response.status === 401 ||
          response.status === 403
        ) {
          sessionStorage.removeItem(SESSION_KEY);
        }
      } catch {
        // Backend may be temporarily unavailable.
      }
    }

    restoreSession().finally(() => {
      if (!cancelled) {
        setCheckingSession(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleLogin(nextSession) {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify(nextSession)
    );

    setSession(nextSession);
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  }

  if (checkingSession) {
    return (
      <main className="shell">
        <p>
          Restoring your StyleCircle session...
        </p>
      </main>
    );
  }

  return (
    <BrowserRouter>
      {session && (
        <nav
          aria-label="StyleCircle navigation"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
            padding: "16px"
          }}
        >
          <Link to="/wardrobe">
            My Closet
          </Link>

          <Link to="/outfits">
            Outfit Builder
          </Link>

          <Link to="/suggestions">
            Smart Mix &amp; Match
          </Link>

          <Link to="/fitchecks">
            FitCheck
          </Link>
        </nav>
      )}

      <Routes>
        <Route
          path="/"
          element={
            <Navigate
              to={
                session
                  ? "/wardrobe"
                  : "/login"
              }
              replace
            />
          }
        />

        <Route
          path="/login"
          element={
            session ? (
              <Navigate
                to="/wardrobe"
                replace
              />
            ) : (
              <AuthPage
                mode="login"
                onLogin={handleLogin}
              />
            )
          }
        />

        <Route
          path="/signup"
          element={
            session ? (
              <Navigate
                to="/wardrobe"
                replace
              />
            ) : (
              <AuthPage
                mode="signup"
                onLogin={handleLogin}
              />
            )
          }
        />

        <Route
          path="/wardrobe"
          element={
            session ? (
              <Wardrobe
                user={session.user}
                token={session.token}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate
                to="/login"
                replace
              />
            )
          }
        />

        <Route
          path="/outfits"
          element={
            session ? (
              <OutfitBuilder
                user={session.user}
                token={session.token}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate
                to="/login"
                replace
              />
            )
          }
        />

        <Route
          path="/suggestions"
          element={
            session ? (
              <Suggestions
                token={session.token}
              />
            ) : (
              <Navigate
                to="/login"
                replace
              />
            )
          }
        />

        <Route
          path="/fitchecks"
          element={
            session ? (
              <FitCheck
                token={session.token}
              />
            ) : (
              <Navigate
                to="/login"
                replace
              />
            )
          }
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
