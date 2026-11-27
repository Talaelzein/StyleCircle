import { Link } from "react-router-dom";
import CategoryCard from "../components/wardrobe/CategoryCard.jsx";
import { resetIntro } from "./Intro.jsx";
import { closetCategories } from "../data/categories.js";

export default function Home({ user }) {
  return (
    <main className="editorial-page">
      <section className="home-hero">
        <div className="home-hero__copy">
          <p className="eyebrow">YOUR SOCIAL FASHION CLOSET</p>
          <h1>Your wardrobe,<br />your style,<br /><em>your circle.</em></h1>
          <p>Welcome{user?.username ? `, ${user.username}` : ""}. An organized wardrobe and a little inspiration for every outfit.</p>
          <div className="button-row">
            <Link className="button-primary" to="/wardrobe">Explore My Closet <span aria-hidden="true">→</span></Link>
            <Link className="button-outline" to="/outfits">Build an Outfit</Link>
          </div>
          <button type="button" className="intro-replay-link" onClick={() => { resetIntro(); window.location.assign("/"); }}>↺ Replay opening animation</button>
        </div>
        <img className="home-hero__art" src="/illustrations/scenes/home-wardrobe.webp" alt="Watercolor fashion illustration of colorful clothes on a rack, handbags, accessories and flowers" />
      </section>
      <section className="home-section" aria-labelledby="explore-heading">
        <div className="section-heading">
          <div><p className="eyebrow">CURATED FOR YOUR CLOSET</p><h2 id="explore-heading">The pieces that make your style.</h2></div>
          <Link to="/wardrobe" className="text-link">Browse all categories ↗</Link>
        </div>
        <div className="home-category-strip">
          {closetCategories.slice(0, 4).map((category) => <CategoryCard key={category.label} category={category} compact />)}
        </div>
      </section>
      <section className="home-steps" aria-labelledby="steps-heading">
        <div><p className="eyebrow">STYLE MADE SIMPLE</p><h2 id="steps-heading">Three steps.<br /><em>That's it.</em></h2></div>
        <ol>
          <li><strong>01. Collect</strong><span>Upload the pieces you own into My Closet.</span></li>
          <li><strong>02. Create</strong><span>Build outfits or discover fresh combinations.</span></li>
          <li><strong>03. Share</strong><span>Ask your circle to vote with FitCheck.</span></li>
        </ol>
      </section>
      <section className="home-section home-actions">
        <div className="section-heading"><div><p className="eyebrow">THE STYLING STUDIO</p><h2>What will you wear next?</h2></div></div>
        <div className="home-action-cards">
          <Link to="/outfits"><span className="home-action-number">01 / CREATE</span><h3>Outfit Builder</h3><p>Pull your favorite pieces together, then save your look.</p><span>Start styling →</span></Link>
          <Link to="/suggestions"><span className="home-action-number">02 / DISCOVER</span><h3>Mix & Match</h3><p>A new perspective on the clothes you already love.</p><span>Find inspiration →</span></Link>
          <Link to="/fitchecks"><span className="home-action-number">03 / CONNECT</span><h3>FitCheck</h3><p>Two outfits, one question. Let your circle decide.</p><span>See FitChecks →</span></Link>
        </div>
      </section>
      <section className="home-section home-actions">
        <div className="section-heading"><div><p className="eyebrow">YOUR EVERYDAY WARDROBE</p><h2>Make every piece count.</h2></div></div>
        <div className="home-action-cards">
          <Link to="/planner"><span className="home-action-number">04 / PLAN</span><h3>Outfit Planner</h3><p>Schedule looks for the week and log what you actually wear.</p><span>Plan your week →</span></Link>
          <Link to="/packing"><span className="home-action-number">05 / TRAVEL</span><h3>Packing Lists</h3><p>Build a capsule suitcase from the clothes you own.</p><span>Plan your packing →</span></Link>
          <Link to="/wishlist"><span className="home-action-number">06 / WISH</span><h3>Wishlist</h3><p>Save pieces you dream about without mixing them into your closet.</p><span>Save a favorite →</span></Link>
        </div>
        <div className="home-action-cards" style={{marginTop:18}}>
          <Link to="/moodboards"><span className="home-action-number">07 / INSPIRE</span><h3>Moodboards</h3><p>Keep style inspiration and creative fashion references.</p><span>Curate inspiration →</span></Link>
          <Link to="/insights"><span className="home-action-number">08 / REFLECT</span><h3>Wardrobe Insights</h3><p>Discover what you wear most and cost per wear.</p><span>Explore your data →</span></Link>
          <Link to="/fitting-room"><span className="home-action-number">09 / TRY</span><h3>Virtual Studio</h3><p>Preview how selected wardrobe pieces might look with AI-assisted front-view try-on.</p><span>Try your style →</span></Link>
        </div>
      </section>
    </main>
  );
}
