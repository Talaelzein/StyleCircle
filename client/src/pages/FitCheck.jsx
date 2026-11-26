import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import useDraftState from "../hooks/useDraftState.js";
import { API_URL, getResponseData } from "../services/api";

const authHeaders = (token) => ({ Authorization: `Bearer ${token}`});

async function apiRequest(path, token, options = {}) {
  const response = await fetch(`${API_URL}/api${path}`, { ...options, headers: { ...authHeaders(token), ...options.headers }});
  return getResponseData(response);
}

function FitCheckPiecePhoto({
  pollId, choice, index, piece, token, shared
}) {
  const [privateUrl, setPrivateUrl] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    setPrivateUrl("");

    if (shared && piece.hasPhoto) {
      fetch(
        `${API_URL}/api/images/fitcheck/${pollId}/${choice}/${index}`,
        {
          headers: authHeaders(token),
          signal: controller.signal
        }
      )
        .then((response) => {
          if (!response.ok) throw new Error("Photo unavailable");
          return response.blob();
        })
        .then((blob) => {
          if (controller.signal.aborted) return;
          objectUrl = URL.createObjectURL(blob);
          setPrivateUrl(objectUrl);
        })
        .catch(() => {});
    }

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ pollId, choice, index, piece.hasPhoto, piece.imageUrl, token, shared ]);

  const remoteUrl = shared && piece.imageUrl?.startsWith("https://") ? piece.imageUrl : "";
  const imageUrl = privateUrl || remoteUrl;

  return (
    <div style={{
      position: "relative",
      height: 155,
      background: "#f3e9e1",
      borderRadius: 12,
      overflow: "hidden"
    }}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={piece.name}
          loading="lazy"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain"
          }}
        />
      ) : (
        <div style={{
          height: "100%",
          display: "grid",
          placeItems: "center",
          padding: 12,
          textAlign: "center",
          fontSize: 12
        }}>
          {piece.name}
        </div>
      )}

      <span style={{
        position: "absolute",
        bottom: 5,
        left: 5,
        padding: "3px 8px",
        borderRadius: 12,
        background: "#fffaf5ed",
        fontSize: 11
      }}>
        {piece.category}
      </span>
    </div>
  );
}

function FitCheckCard({ poll, token, busyId, onVote, onShare, onClose, onDelete }) {
  const votesA = poll.votes?.A ?? 0;
  const votesB = poll.votes?.B ?? 0;
  const total = votesA + votesB;
  const busy = busyId !== null;

  return (
    <article className="clothing-card">
      <h3>{poll.question}</h3>
      <p>
        <strong>Status:</strong>{" "}
        {poll.status === "open" ? "Open for voting" : "Voting closed"}
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 14
      }}>
        {(poll.looks || []).map((look, index) => {
          const choice = index === 0 ? "A" : "B";
          const votes = choice === "A" ? votesA : votesB;
          const percentage = total ? Math.round((votes / total) * 100) : 0;

          return (
            <section
              key={choice}
              style={{
                border: `2px solid ${ poll.myVote === choice ? "#8d3049" : "#e5dbd4"}`,
                borderRadius: 14,
                padding: 15
              }}
            >
              <h3>Outfit {choice}</h3>
              <h4>{look.name}</h4>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 8,
                margin: "14px 0"
              }}>
                {(look.pieces || []).map((piece, i) => (
                  <FitCheckPiecePhoto
                    key={`${choice}-${i}`}
                    pollId={poll._id}
                    choice={choice}
                    index={i}
                    piece={piece}
                    token={token}
                    shared={!!poll.photosShared}
                  />
                ))}
              </div>

              <ul>
                {(look.pieces || []).map((piece, i) => (
                  <li key={i}>
                    {piece.name} - {piece.category}
                    {piece.color ? ` (${piece.color})` : ""}
                  </li>
                ))}
              </ul>

              <p>
                <strong>{votes} vote(s)</strong> — {percentage}%
              </p>

              {!poll.isOwner && poll.status === "open" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onVote(poll._id, choice)}
                >
                  {poll.myVote === choice ? `Voted ${choice} `: `Vote for ${choice}`}
                </button>
              )}
            </section>
          );
        })}
      </div>

      {poll.isOwner && (
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginTop: 16
        }}>
          {!poll.photosShared && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onShare(poll._id)}
            > Share outfit photos
            </button>
          )}

          {poll.status === "open" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onClose(poll._id)}
            >
              Close Voting
            </button>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() => onDelete(poll._id)}
          >
            Delete FitCheck
          </button>
        </div>
      )}
    </article>
  );
}

export default function FitCheck({ token, user }) {
  const [params] = useSearchParams();
  const draftKey = `stylecircle-draft:${user.id}:fitcheck`;
  const [question, setQuestion] = useDraftState( `${draftKey}:question`, "" );
  const [outfitA, setOutfitA] = useDraftState( `${draftKey}:outfitA`, "" );
  const [outfitB, setOutfitB] = useDraftState( `${draftKey}:outfitB`, "");
  const [outfits, setOutfits] = useState([]);
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const lookA = params.get("lookA");
  const lookB = params.get("lookB");

  useEffect(() => {
    if (lookA && lookB && lookA !== lookB) {
      setOutfitA(lookA);
      setOutfitB(lookB);
      setQuestion("Which StyleCircle look should I wear?");
    }
  }, [lookA, lookB, setOutfitA, setOutfitB, setQuestion]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadData() {
      try {
        const [outfitData, pollData] = await Promise.all([
          apiRequest("/outfits", token, {
            signal: controller.signal
          }),
          apiRequest("/fitchecks", token, {
            signal: controller.signal
          })
        ]);

        if (!controller.signal.aborted) {
          setOutfits(outfitData.outfits || []);
          setPolls(pollData.polls || []);
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadData();
    return () => controller.abort();
  }, [token]);

  function notify(message) {
    setError("");
    setSuccess(message);
  }

  async function runPollAction(id, action) {
    setBusyId(id);
    setError("");
    setSuccess("");

    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function postFitCheck(event) {
    event.preventDefault();

    if (!outfitA || !outfitB || outfitA === outfitB) {
      setError("Please choose two different outfits.");
      return;
    }

    setPosting(true);
    setError("");
    setSuccess("");

    try {
      const data = await apiRequest("/fitchecks", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          outfitIds: [outfitA, outfitB]
        })
      });

      setPolls((previous) => [data.poll, ...previous]);
      setQuestion("");
      setOutfitA("");
      setOutfitB("");
      notify("Your FitCheck is now posted!");
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  function vote(id, choice) {
    return runPollAction(id, async () => {
      const data = await apiRequest( `/fitchecks/${id}/vote`,token,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ choice })
        }
      );

      setPolls((previous) =>
        previous.map((poll) =>
          poll._id === id ? { ...poll, votes: data.votes, myVote: data.myVote } : poll
      )
      );

      notify("Your vote was saved!");
    });
  }

  function shareOldPhotos(id) {
    if (!window.confirm(
      "Share these outfit photos with other StyleCircle users?"
    )) return;

    return runPollAction(id, async () => {
      const data = await apiRequest( `/fitchecks/${id}/share-photos`, token,{ method: "PATCH" }
      );

      setPolls((previous) =>
        previous.map((poll) =>
          poll._id === id ? { ...poll, ...data } : poll
        )
      );

      notify("Outfit photos shared. Existing votes are preserved.");
    });
  }

  function closePoll(id) {
    return runPollAction(id, async () => {
      const data = await apiRequest(
        `/fitchecks/${id}/close`,
        token,
        { method: "PATCH" }
      );

      setPolls((previous) =>
        previous.map((poll) =>
          poll._id === id
            ? { ...poll, status: data.status }
            : poll
        )
      );

      notify("Voting closed successfully.");
    });
  }

  function deletePoll(id) {
    if (!window.confirm(
      "Delete this FitCheck? This cannot be undone."
    )) return;

    return runPollAction(id, async () => {
      await apiRequest(`/fitchecks/${id}`, token, {
        method: "DELETE"
      });

      setPolls((previous) =>
        previous.filter((poll) => poll._id !== id)
      );

      notify("FitCheck deleted.");
    });
  }

  return (
    <main className="shell">
      <h1>Style<span>Circle</span></h1>

      <section className="panel">
        <h2>FitCheck: A or B ? </h2>

        <p>
          Can't decide what to wear?
          Let the StyleCircle community vote!
        </p>

        <p>
          <Link to="/outfits">My Saved Outfits</Link>
        </p>

        {error && (
          <p className="error" role="alert">{error}</p>
        )}

        {success && (
          <p role="status">{success}</p>
        )}

        {loading ? (
          <p>Loading FitChecks...</p>
        ) : (
          <>
            <h3>Create a FitCheck</h3>

            {outfits.length < 2 ? (
              <p>
                You need two saved outfits.{" "}
                <Link to="/outfits">Create outfits first</Link>.
              </p>
            ) : (
              <form className="auth-form" onSubmit={postFitCheck}>
                <label>
                  Your question
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Which outfit should I wear tonight?"
                    minLength={5}
                    maxLength={160}
                    required
                  />
                </label>

                {[
                  ["Outfit A", outfitA, setOutfitA, outfitB],
                  ["Outfit B", outfitB, setOutfitB, outfitA]
                ].map(([label, value, setter, other]) => (
                  <label key={label}>
                    {label}
                    <select
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      required
                    >
                      <option value="">
                        Choose {label.toLowerCase()}
                      </option>

                      {outfits.map((outfit) => (
                        <option
                          key={outfit._id}
                          value={outfit._id}
                          disabled={outfit._id === other}
                        >
                          {outfit.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}

                <p style={{ fontSize: 12, color: "#756961" }}>
                  Posting a FitCheck shares the selected clothing
                  photos with logged-in users.
                </p>

                <button
                  type="submit"
                  disabled={
                    posting || !outfitA || !outfitB ||
                    outfitA === outfitB
                  }
                >
                  {posting ? "Posting..." : "Post FitCheck"}
                </button>
              </form>
            )}

            <hr />
            <h2>Community FitChecks</h2>

            {polls.length === 0 ? (
              <p>No FitChecks yet. Be the first to post one!</p>
            ) : (
              polls.map((poll) => (
                <FitCheckCard
                  key={poll._id}
                  poll={poll}
                  token={token}
                  busyId={busyId}
                  onVote={vote}
                  onShare={shareOldPhotos}
                  onClose={closePoll}
                  onDelete={deletePoll}
                />
              ))
            )}
          </>
        )}
      </section>
    </main>
  );
}

