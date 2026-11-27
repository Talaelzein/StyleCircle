import { useEffect, useState } from "react";
import { API_URL } from "../../services/api.js";
const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });

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

export default function FitCheckCard({ poll, token, busyId, onVote, onShare, onClose, onDelete }) {
  const votesA = poll.votes?.A ?? 0;
  const votesB = poll.votes?.B ?? 0;
  const total = votesA + votesB;
  const busy = busyId !== null;

  return (
    <article className="clothing-card fitcheck-card">
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
                border: `2px solid ${poll.myVote === choice ? "var(--accent)" : "var(--line)"}`,
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

              {poll.canViewResults !== false && poll.votes ? (
                <p className="fitcheck-vote-results"><strong>{votes} vote(s)</strong> - {percentage}%</p>
              ) : (
                <p className="fitcheck-vote-hint">Vote to reveal the results.</p>
              )}
              {!poll.isOwner && poll.myVote && (
                <p role="status" className="fitcheck-final-vote">Your final vote: {poll.myVote}</p>
              )}

              {!poll.isOwner && !poll.myVote && poll.status === "open" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onVote(poll._id, choice)}
                >
                  {`Vote for ${choice}`}
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

