
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  API_URL,
  getResponseData
} from "../services/api";

const EMPTY_PREFERENCES = {
  occasion: "",
  season: "",
  style: ""
};

export default function Suggestions({ token }) {
  const [preferences, setPreferences] = useState({
    ...EMPTY_PREFERENCES
  });

  const [appliedPreferences, setAppliedPreferences] =
    useState({ ...EMPTY_PREFERENCES });

  const [suggestions, setSuggestions] = useState(null);
  const [names, setNames] = useState({});
  const [saved, setSaved] = useState({});
  const [loading, setLoading] = useState(false);
  const [savingIndex, setSavingIndex] = useState(null);
  const [error, setError] = useState("");

  function changePreference(event) {
    const { name, value } = event.target;

    setPreferences((previous) => ({
      ...previous,
      [name]: value
    }));
  }

  // Ask Express for outfit recommendations.
  async function findSuggestions(event) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setSuggestions(null);
    setSaved({});
    setNames({});

    const selected = {
      occasion: preferences.occasion.trim(),
      season: preferences.season.trim(),
      style: preferences.style.trim()
    };

    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(selected)) {
      if (value) {
        params.set(key, value);
      }
    }

    const query = params.toString();

    const url = `${API_URL}/api/suggestions${
      query ? `?${query}` : ""
    }`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await getResponseData(response);

      setSuggestions(data.suggestions);
      setAppliedPreferences(selected);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Save a suggested combination in My Outfits.
  async function saveOutfit(suggestion, index) {
    const name = (
      names[index] ?? `Smart Look ${index + 1}`
    ).trim();

    if (!name) {
      setError(
        "Please enter a name before saving the outfit."
      );
      return;
    }

    setSavingIndex(index);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/outfits`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name,
            clothingItemIds:
              suggestion.clothingItemIds,
            occasion: appliedPreferences.occasion,
            notes:
              "Created with StyleCircle Smart Mix & Match"
          })
        }
      );

      await getResponseData(response);

      setSaved((previous) => ({
        ...previous,
        [index]: true
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingIndex(null);
    }
  }

  return (
    <main className="shell">
      <h1>
        Style<span>Circle</span>
      </h1>

      <section className="panel">
        <h2>Smart Mix &amp; Match</h2>

        <p>
          Discover outfits using the clothes
          already in My Closet.
        </p>

        <p>
          <Link to="/wardrobe">My Closet</Link>
          {" · "}
          <Link to="/outfits">
            Saved Outfits
          </Link>
        </p>

        <form
          className="auth-form"
          onSubmit={findSuggestions}
        >
          <label>
            Occasion (optional)

            <input
              name="occasion"
              value={preferences.occasion}
              onChange={changePreference}
              placeholder="University, Dinner, Party..."
              maxLength={60}
            />
          </label>

          <label>
            Season (optional)

            <input
              name="season"
              value={preferences.season}
              onChange={changePreference}
              placeholder="Summer, Winter..."
              maxLength={40}
            />
          </label>

          <label>
            Style (optional)

            <input
              name="style"
              value={preferences.style}
              onChange={changePreference}
              placeholder="Casual, Formal..."
              maxLength={40}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Finding outfits..."
              : "Suggest Outfits"}
          </button>
        </form>

        {error && (
          <p
            role="alert"
            className="error"
          >
            {error}
          </p>
        )}

        {suggestions !== null && (
          <section aria-label="Suggested outfits">
            <h3>Your Recommendations</h3>

            {suggestions.length === 0 ? (
              <p>
                No complete combinations yet.
                Add a top and a bottom, or
                a dress with shoes or outerwear,
                in My Closet.
              </p>
            ) : (
              <div>
                {suggestions.map(
                  (suggestion, index) => (
                    <article
                      className="clothing-card"
                      key={suggestion.clothingItemIds.join(
                        "-"
                      )}
                    >
                      <h3>
                        Look {index + 1}
                      </h3>

                      <p>
                        <strong>
                          Match score:
                        </strong>
                        {" "}
                        {suggestion.score}
                      </p>

                      <p>
                        {suggestion.reason}
                      </p>

                      <ul>
                        {suggestion.items.map(
                          (item) => (
                            <li key={item._id}>
                              {item.name}
                              {" — "}
                              {item.category}

                              {item.color
                                ? ` (${item.color})`
                                : ""}
                            </li>
                          )
                        )}
                      </ul>

                      <label>
                        Outfit name

                        <input
                          type="text"
                          maxLength={80}
                          value={
                            names[index] ??
                            `Smart Look ${index + 1}`
                          }
                          onChange={(event) => {
                            setNames((previous) => ({
                              ...previous,
                              [index]:
                                event.target.value
                            }));
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        disabled={
                          savingIndex !== null ||
                          saved[index]
                        }
                        onClick={() =>
                          saveOutfit(
                            suggestion,
                            index
                          )
                        }
                      >
                        {saved[index]
                          ? "Saved!"
                          : savingIndex === index
                            ? "Saving..."
                            : "Save to My Outfits"}
                      </button>

                      {saved[index] && (
                        <p role="status">
                          Outfit saved!
                          {" "}
                          View it in
                          {" "}
                          <Link to="/outfits">
                            Outfit Builder
                          </Link>.
                        </p>
                      )}
                    </article>
                  )
                )}
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
