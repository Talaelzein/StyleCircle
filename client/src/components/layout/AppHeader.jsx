import { Link, NavLink } from "react-router-dom";

const navItems = [
  {to:"/home",label:"Home"},
  {to:"/wardrobe",label:"My Closet"},
  {to:"/outfits",label:"Outfits"},
  {to:"/suggestions",label:"Mix & Match"},
  {to:"/fitchecks",label:"FitCheck"},
  {to:"/planner",label:"Planner"},
  {to:"/packing",label:"Packing"},
  {to:"/wishlist",label:"Wishlist"},
  {to:"/moodboards",label:"Moodboards"},
  {to:"/insights",label:"Insights"},
  {to:"/fitting-room",label:"Style Studio"}
];

export default function AppHeader({ user, onLogout }) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/home" className="site-logo" aria-label="StyleCircle home">StyleCircle</Link>
        <nav className="site-nav" aria-label="StyleCircle navigation">
          {navItems.map(({ to, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => `site-nav__link ${isActive ? "is-active" : ""}`}
            >{label}</NavLink>
          ))}
        </nav>
        <div className="site-header__actions">
          <span className="user-pill" title={user?.username || "Your account"}>
            <span className="user-pill__avatar" aria-hidden="true">{(user?.username || "S").charAt(0).toUpperCase()}</span>
            <span className="user-pill__name">{user?.username || "My account"}</span>
          </span>
          <button type="button" className="text-button logout-button" onClick={onLogout}>Log out</button>
        </div>
      </div>
    </header>
  );
}
