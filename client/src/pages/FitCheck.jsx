
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  API_URL,
  getResponseData
} from "../services/api";

export default function FitCheck({ token }) {
  const [outfits, setOutfits] = useState([]);
  const [polls, setPolls] = useState([]);

  const [question, setQuestion] = useState("");
  const [outfitA, setOutfitA] = useState("");
  const [outfitB, setOutfitB] = useState("");

  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const headers = {
          Authorization: `Bearer ${token}`
        };

        const [outfitResponse, pollResponse] =
          await Promise.all([
            fetch(`${API_URL}/api/outfits`, {
              headers,
              signal: controller.signal
            }),
            fetch(`${API_URL}/api/fitchecks`, {
              headers,
              signal: controller.signal
            })
          ]);

        const [outfitData, pollData] =
          await Promise.all([
            getResponseData(outfitResponse),
            getResponseData(pollResponse)
          ]);

        if (!controller.signal.aborted) {
          setOutfits(outfitData.outfits);
          setPolls(pollData.polls);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => controller.abort();
  }, [token]);

  async function postFitCheck(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (outfitA === outfitB) {
      setError("Please choose two different outfits.");
      return;
    }

    setPosting(true);

    try {
      const response = await fetch(
        `${API_URL}/api/fitchecks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            question: question.trim(),
            outfitIds: [outfitA, outfitB]
          })
        }
      );

      const data = await getResponseData(response);

      setPolls((previous) => [
        data.poll,
        ...previous
      ]);

      setQuestion("");
      setOutfitA("");
      setOutfitB("");

      setSuccess("Your FitCheck is now posted!");
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  async function vote(pollId, choice) {
    setBusyId(pollId);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/api/fitchecks/${pollId}/vote`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ choice })
        }
      );

      const data = await getResponseData(response);

      setPolls((previous) =>
        previous.map((poll) =>
          poll._id === pollId
            ? {
                ...poll,
                votes: data.votes,
                myVote: data.myVote
              }
            : poll
        )
      );

      setSuccess("Your vote was saved!");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function closePoll(pollId) {
    setBusyId(pollId);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/api/fitchecks/${pollId}/close`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await getResponseData(response);

      setPolls((previous) =>
        previous.map((poll) =>
          poll._id === pollId
            ? { ...poll, status: data.status }
            : poll
        )
      );

      setSuccess("Voting closed successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function deletePoll(pollId) {
    if (
      !window.confirm(
        "Are you sure you want to delete this FitCheck?"
      )
    ) {
      return;
    }

    setBusyId(pollId);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/api/fitchecks/${pollId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        await getResponseData(response);
      }

      setPolls((previous) =>
        previous.filter(
          (poll) => poll._id !== pollId
        )
      );

      setSuccess("FitCheck deleted.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="shell">
      <h1>
        Style<span>Circle</span>
      </h1>

      <section className="panel">
        <h2>FitCheck — A or B? 💕</h2>

        <p>
          Can't decide what to wear?
          Let the StyleCircle community vote!
        </p>

        <p>
          <Link to="/outfits">
            My Saved Outfits
          </Link>
        </p>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {success && (
          <p role="status">
            {success}
          </p>
        )}

        {loading ? (
          <p>Loading FitChecks...</p>
        ) : (
          <>
            <h3>Create a FitCheck</h3>

            {outfits.length < 2 ? (
              <p>
                You need at least two saved
                outfits to create a FitCheck.
                {" "}
                <Link to="/outfits">
                  Create outfits first
                </Link>.
              </p>
            ) : (
              <form
                className="auth-form"
                onSubmit={postFitCheck}
              >
                <label>
                  Your question

                  <input
                    type="text"
                    value={question}
                    onChange={(event) =>
                      setQuestion(event.target.value)
                    }
                    placeholder="Which outfit should I wear tonight?"
                    minLength={5}
                    maxLength={160}
                    required
                  />
                </label>

                <label>
                  Outfit A

                  <select
                    value={outfitA}
                    onChange={(event) =>
                      setOutfitA(event.target.value)
                    }
                    required
                  >
                    <option value="">
                      Choose first outfit
                    </option>

                    {outfits.map((outfit) => (
                      <option
                        value={outfit._id}
                        key={outfit._id}
                        disabled={
                          outfit._id === outfitB
                        }
                      >
                        {outfit.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Outfit B

                  <select
                    value={outfitB}
                    onChange={(event) =>
                      setOutfitB(event.target.value)
                    }
                    required
                  >
                    <option value="">
                      Choose second outfit
                    </option>

                    {outfits.map((outfit) => (
                      <option
                        value={outfit._id}
                        key={outfit._id}
                        disabled={
                          outfit._id === outfitA
                        }
                      >
                        {outfit.name}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="submit"
                  disabled={
                    posting ||
                    !outfitA ||
                    !outfitB ||
                    outfitA === outfitB
                  }
                >
                  {posting
                    ? "Posting..."
                    : "Post FitCheck"}
                </button>
              </form>
            )}

            <hr />

            <h2>Community FitChecks</h2>

            {polls.length === 0 ? (
              <p>
                No FitChecks yet.
                Be the first to post one!
              </p>
            ) : (
              polls.map((poll) => {
                const votesA = poll.votes?.A || 0;
                const votesB = poll.votes?.B || 0;
                const total = votesA + votesB;

                const percentageA = total
                  ? Math.round(
                      (votesA / total) * 100
                    )
                  : 0;

                const percentageB = total
                  ? Math.round(
                      (votesB / total) * 100
                    )
                  : 0;

                return (
                  <article
                    className="clothing-card"
                    key={poll._id}
                  >
                    <h3>{poll.question}</h3>

                    <p>
                      <strong>Status:</strong>
                      {" "}
                      {poll.status === "open"
                        ? "Open for voting"
                        : "Voting closed"}
                    </p>

                    {poll.isOwner && (
                      <p>
                        This is your FitCheck.
                      </p>
                    )}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: "14px"
                      }}
                    >
                      {poll.looks.map(
                        (look, index) => {
                          const choice =
                            index === 0 ? "A" : "B";

                          const votes =
                            choice === "A"
                              ? votesA
                              : votesB;

                          const percentage =
                            choice === "A"
                              ? percentageA
                              : percentageB;

                          return (
                            <div
                              key={choice}
                              style={{
                                border:
                                  poll.myVote === choice
                                    ? "2px solid #7c3aed"
                                    : "1px solid #ddd",
                                borderRadius: "12px",
                                padding: "14px"
                              }}
                            >
                              <h3>
                                Outfit {choice}
                              </h3>

                              <h4>{look.name}</h4>

                              <ul>
                                {look.pieces.map(
                                  (piece, i) => (
                                    <li key={i}>
                                      {piece.name}
                                      {" — "}
                                      {piece.category}
                                      {piece.color
                                        ? ` (${piece.color})`
                                        : ""}
                                    </li>
                                  )
                                )}
                              </ul>

                              <p>
                                <strong>
                                  {votes} vote(s)
                                </strong>
                                {" — "}
                                {percentage}%
                              </p>

                              {!poll.isOwner &&
                                poll.status === "open" && (
                                  <button
                                    type="button"
                                    disabled={
                                      busyId !== null
                                    }
                                    onClick={() =>
                                      vote(
                                        poll._id,
                                        choice
                                      )
                                    }
                                  >
                                    {poll.myVote === choice
                                      ? `Voted ${choice} ✓`
                                      : `Vote for ${choice}`}
                                  </button>
                                )}
                            </div>
                          );
                        }
                      )}
                    </div>

                    {poll.isOwner && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "10px",
                          marginTop: "16px"
                        }}
                      >
                        {poll.status === "open" && (
                          <button
                            type="button"
                            disabled={
                              busyId !== null
                            }
                            onClick={() =>
                              closePoll(poll._id)
                            }
                          >
                            Close Voting
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() =>
                            deletePoll(poll._id)
                          }
                        >
                          Delete FitCheck
                        </button>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </>
        )}
      </section>
    </main>
  );
}
