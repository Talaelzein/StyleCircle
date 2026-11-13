import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';

function Home() {
  return (
    <main className="shell">
      <div className="eyebrow">WEB PROGRAMMING · TEAM CAPSTONE</div>
      <h1>Style<span>Circle</span></h1>
      <p className="subtitle">Your social fashion closet.</p>
      <div className="panel">
        <h2>Milestone 1 scaffold ready</h2>
        <p>Next: implement and test the Milestone 2 backend. The wardrobe UI will be connected during Milestone 3.</p>
        <ul>
          <li>React and client-side routing scaffold</li>
          <li>Express REST API in the separate server folder</li>
          <li>MongoDB, signup/login, JWT, and protected CRUD in the backend</li>
        </ul>
      </div>
      <Link to="/about">About StyleCircle</Link>
    </main>
  );
}

function About() {
  return <main className="shell"><h1>About StyleCircle</h1><p>Digital wardrobe + outfits + social polls, coming in later milestones.</p><Link to="/">Back home</Link></main>;
}

export default function App() {
  return <BrowserRouter><Routes><Route path="/" element={<Home />} /><Route path="/about" element={<About />} /></Routes></BrowserRouter>;
}
