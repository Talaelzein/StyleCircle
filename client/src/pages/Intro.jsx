import { useEffect, useState } from "react";

const INTRO_KEY = "stylecircle_intro_seen";
export function hasSeenIntro() { return new URLSearchParams(window.location.search).get("replay") !== "1" && sessionStorage.getItem(INTRO_KEY) === "yes"; }
export function resetIntro() { sessionStorage.removeItem(INTRO_KEY); }

export default function Intro({ onFinish }) {
  const [organized, setOrganized] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setOrganized(true), 3700);
    return () => window.clearTimeout(t);
  }, []);
  function finish() { sessionStorage.setItem(INTRO_KEY, "yes"); onFinish(); }
  return (
    <main className="intro-screen">
      <div className="intro-screen__masthead">StyleCircle <span>YOUR SOCIAL FASHION CLOSET</span></div>
      <div className={`intro-layout ${organized ? "intro-layout--finished" : ""}`}>
        <div className="intro-copy">
          <p className="eyebrow">WELCOME TO STYLECIRCLE</p>
          <h1>{organized ? "Your wardrobe, your style, your circle." : "From closet chaos to clarity."}</h1>
          <p className="intro-lead">{organized ? "A home for every piece, every look, and every version of you." : "A girl, a wardrobe full of possibilities, and a little fashion chaos."}</p>
          <button className="button-primary" onClick={finish}>{organized ? "Enter StyleCircle" : "Skip intro"} <span aria-hidden="true">→</span></button>
          <p className="intro-caption" aria-live="polite">{organized ? "Your closet is ready." : "Organizing your wardrobe…"}</p>
        </div>
        <div className="intro-illustration" aria-label={organized ? "An organized illustrated fashion closet" : "An illustrated messy closet"}>
          <img className={`intro-illustration__frame intro-illustration__girl ${organized ? "is-hidden" : ""}`} src="/illustrations/scenes/closet-girl.gif" alt="" />
        </div>
      </div>
      <div className="intro-progress" aria-hidden="true"><span className={organized ? "is-complete" : ""} /></div>
    </main>
  );
}
