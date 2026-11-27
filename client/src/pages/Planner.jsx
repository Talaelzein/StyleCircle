import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useStyleEntries from "../hooks/useStyleEntries.js";
import useClosetData from "../hooks/useClosetData.js";
import "../styles/styling-studio.css";
import "../styles/collections.css";

function isoDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function calendarDays(month) {
  const [year, number] = month.split("-").map(Number);
  const offset = new Date(year, number - 1, 1).getDay();
  const count = new Date(year, number, 0).getDate();
  return Array.from({ length: offset + count }, (_, index) =>
    index < offset ? "" : String(index - offset + 1).padStart(2, "0")
  );
}

export default function Planner({ token }) {
  const plans = useStyleEntries("plan", token);
  const wears = useStyleEntries("wear", token);
  const { outfits, error: closetError } = useClosetData(token);

  const [month, setMonth] = useState(() => isoDate(new Date()).slice(0, 7));
  const [day, setDay] = useState(() => isoDate(new Date()));
  const [outfitId, setOutfitId] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [year, number] = month.split("-").map(Number);
  const days = useMemo(() => calendarDays(month), [month]);
  const current = useMemo(
    () => plans.entries.filter((entry) => entry.date === day),
    [plans.entries, day]
  );
  const byId = new Map(outfits.map((outfit) => [String(outfit._id), outfit]));

  async function add(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const outfit = byId.get(outfitId);
      if (!outfit) throw new Error("Choose a saved outfit first");
      await plans.create({
        title: title.trim() || outfit.name,
        date: day,
        outfitId
      });
      setTitle("");
      setMessage("Outfit planned.");
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  async function markWorn(plan) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const outfit = byId.get(String(plan.outfitId));
      if (!outfit) throw new Error("Outfit is unavailable");
      const itemIds = (outfit.clothingItemIds || [])
        .filter(Boolean)
        .map((item) => typeof item === "string" ? item : String(item._id));
      await wears.create({
        title: plan.title,
        date: plan.date,
        outfitId: String(plan.outfitId),
        itemIds
      });
      await plans.update(plan._id, { completed: true });
      setMessage("Logged as worn! Wardrobe Insights will include it.");
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  async function removePlan(id) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await plans.remove(id);
      setMessage("Planned outfit removed.");
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  function moveMonth(delta) {
    const date = new Date(`${month}-01T12:00:00`);
    date.setMonth(date.getMonth() + delta);
    const next = isoDate(date).slice(0, 7);
    setMonth(next);
    setDay(`${next}-01`);
  }

  return (
    <main className="editorial-page collection-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">STYLECIRCLE CALENDAR</p>
          <h1>Outfit Planner</h1>
          <p>Plan what to wear, log real outfits, and make getting dressed effortless.</p>
        </div>
        <Link className="button-outline" to="/outfits">Your saved outfits</Link>
      </section>

      <div className="collection-two-col">
        <section className="collection-card" aria-label="Outfit calendar">
          <div className="collection-month">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => moveMonth(-1)}
            >←</button>
            <h2>{new Date(year, number - 1, 1).toLocaleString("en-US", {
              month: "long", year: "numeric"
            })}</h2>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => moveMonth(1)}
            >→</button>
          </div>

          <div className="calendar-grid">
            {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
              <b key={index} aria-hidden="true">{label}</b>
            ))}
            {days.map((date, index) => {
              const selected = Boolean(date) && day === `${month}-${date}`;
              const planned = Boolean(date) && plans.entries.some(
                (entry) => entry.date === `${month}-${date}`
              );
              return (
                <button
                  key={index}
                  type="button"
                  disabled={!date}
                  aria-label={date ? `Select ${month}-${date}${planned ? ", has outfits" : ""}` : "Empty calendar cell"}
                  aria-pressed={selected}
                  className={`${selected ? "selected" : ""} ${planned ? "has-look" : ""}`}
                  onClick={() => setDay(`${month}-${date}`)}
                >
                  {date ? Number(date) : ""}
                </button>
              );
            })}
          </div>
          <p className="collection-help">
            Dots mark days with planned outfits. Select a day to see or edit its looks.
          </p>
        </section>

        <section className="collection-card">
          <p className="eyebrow">SELECTED DAY</p>
          <h2>{day}</h2>
          <h3>Planned looks</h3>
          {!current.length ? (
            <p>No looks planned yet.</p>
          ) : (
            <div className="entry-list">
              {current.map((plan) => (
                <article key={plan._id}>
                  <div>
                    <strong>{plan.title}</strong>
                    <small>{plan.completed ? "✓ Worn" : "Planned"}</small>
                  </div>
                  <div className="entry-actions">
                    {!plan.completed && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => markWorn(plan)}
                      >Mark worn</button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => removePlan(plan._id)}
                    >Remove</button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <form className="collection-form" onSubmit={add}>
            <h3>Schedule an outfit</h3>
            <label>
              Saved outfit
              <select value={outfitId} onChange={(event) => setOutfitId(event.target.value)} required>
                <option value="">Choose an outfit</option>
                {outfits.map((outfit) => (
                  <option key={outfit._id} value={outfit._id}>{outfit.name}</option>
                ))}
              </select>
            </label>
            <label>
              Event or note (optional)
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Monday lecture, brunch..."
                maxLength={120}
              />
            </label>
            <button className="button-primary" disabled={busy || !outfitId}>
              Add to {day}
            </button>
          </form>
          {!outfits.length && (
            <p><Link to="/outfits">Create a saved outfit</Link> before planning.</p>
          )}
          {(error || plans.error || wears.error || closetError) && (
            <p className="error" role="alert">
              {error || plans.error || wears.error || closetError}
            </p>
          )}
          {message && <p role="status">{message}</p>}
        </section>
      </div>
      <p className="collection-help">
        Your wear history is private to your account. Marking an outfit worn increases
        its wardrobe usage statistics; planning alone does not.
      </p>
    </main>
  );
}
