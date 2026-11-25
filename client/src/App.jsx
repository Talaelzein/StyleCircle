import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { API_URL } from "./services/api";
import AuthPage from "./pages/AuthPage.jsx";
import Wardrobe from "./pages/Wardrobe.jsx";
import OutfitBuilder from "./pages/OutfitBuilder.jsx";
import Suggestions from "./pages/Suggestions.jsx";
import FitCheck from "./pages/FitCheck.jsx";
import FittingRoom from "./pages/FittingRoom.jsx";
import Intro, { hasSeenIntro } from "./pages/Intro.jsx";
import Home from "./pages/Home.jsx";
import AppHeader from "./components/layout/AppHeader.jsx";
import { clearUserDrafts } from "./hooks/useDraftState.js";
import Planner from "./pages/Planner.jsx";
import Packing from "./pages/Packing.jsx";
import Wishlist from "./pages/Wishlist.jsx";
import Moodboards from "./pages/Moodboards.jsx";
import Insights from "./pages/Insights.jsx";

const SESSION_KEY = "stylecircle_session";

export default function App() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [introSeen, setIntroSeen] = useState(hasSeenIntro);

  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      let saved;
      try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return;
        saved = JSON.parse(raw);
        if (!saved?.token || typeof saved.token !== "string") {
          sessionStorage.removeItem(SESSION_KEY);
          return;
        }
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
        return;
      }
      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${saved.token}` }
        });
        if (response.ok) {
          const data = await response.json();
          if (!cancelled && data.user) setSession({ token: saved.token, user: data.user });
        } else if (response.status === 401 || response.status === 403) {
          sessionStorage.removeItem(SESSION_KEY);
        }
      } catch { /* An offline backend shouldn't destroy a saved login. */ }
    }
    restoreSession().finally(() => { if (!cancelled) setCheckingSession(false); });
    return () => { cancelled = true; };
  }, []);

  function handleLogin(nextSession) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
  }
  function handleLogout() {
    clearUserDrafts(session?.user?.id);
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  }
  if (checkingSession) return <main className="app-loading">Opening StyleCircle…</main>;

  return (
    <BrowserRouter>
      {session && <AppHeader user={session.user} onLogout={handleLogout} />}
      <Routes>
        <Route path="/" element={
          introSeen ? <Navigate to={session ? "/home" : "/login"} replace />
          : <Intro onFinish={() => setIntroSeen(true)} />
        } />
        <Route path="/login" element={session ? <Navigate to="/home" replace /> :
          <AuthPage mode="login" onLogin={handleLogin} />} />
        <Route path="/signup" element={session ? <Navigate to="/home" replace /> :
          <AuthPage mode="signup" onLogin={handleLogin} />} />
        <Route path="/home" element={session ? <Home user={session.user} /> : <Navigate to="/login" replace />} />
        <Route path="/wardrobe" element={session ? <Wardrobe user={session.user} token={session.token} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
        <Route path="/wardrobe/:category" element={session ? <Wardrobe user={session.user} token={session.token} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
        <Route path="/outfits" element={session ? <OutfitBuilder user={session.user} token={session.token} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
        <Route path="/suggestions" element={session ? <Suggestions token={session.token} user={session.user} /> : <Navigate to="/login" replace />} />
        <Route path="/fitchecks" element={session ? <FitCheck token={session.token} user={session.user} /> : <Navigate to="/login" replace />} />
        <Route path="/fitting-room" element={session ? <FittingRoom token={session.token} user={session.user} /> : <Navigate to="/login" replace />} />
        <Route path="/planner" element={session ? <Planner token={session.token} user={session.user}/> : <Navigate to="/login" replace/>}/>
        <Route path="/packing" element={session ? <Packing token={session.token} user={session.user}/> : <Navigate to="/login" replace/>}/>
        <Route path="/wishlist" element={session ? <Wishlist token={session.token} user={session.user}/> : <Navigate to="/login" replace/>}/>
        <Route path="/moodboards" element={session ? <Moodboards token={session.token} user={session.user}/> : <Navigate to="/login" replace/>}/>
        <Route path="/insights" element={session ? <Insights token={session.token} user={session.user}/> : <Navigate to="/login" replace/>}/>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {session && <footer className="site-footer"><span>StyleCircle</span><span>Your wardrobe, your style, your circle.</span></footer>}
    </BrowserRouter>
  );
}
