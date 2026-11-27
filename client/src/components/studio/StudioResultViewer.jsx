// Before/after preview and export controls. Generation state remains with the page.
export default function StudioResultViewer({
  photo, result, generating, hasSelection, downloadResult, importResult
}) {
  return (
        <section className="auto-studio-panel auto-studio-viewer">
          <h2>Your fitting room</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
              gap: 16
            }}
          >
            <div>
              <h3 style={{ textAlign: "center" }}>Before</h3>

              <div
                className="auto-studio-stage"
                style={{ minHeight: 440 }}
              >
                {photo ? (
                  <img
                    className="auto-studio-body"
                    src={photo.url}
                    alt="Original full-body photograph"
                  />
                ) : (
                  <div className="auto-studio-empty">
                    <h3>Your photo</h3>
                    <p>Upload a full-body photograph.</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 style={{ textAlign: "center" }}>AI Try-On</h3>

              <div
                className="auto-studio-stage"
                style={{ minHeight: 440 }}
              >
                {result ? (
                  <img
                    className="auto-studio-body"
                    src={result.url}
                    alt="Realistic AI-generated clothing try-on"
                  />
                ) : (
                  <div className="auto-studio-empty">
                    <span>✦</span>
                    <h3>
                      {generating
                        ? "AI is creating your look"
                        : "Your new look"}
                    </h3>
                    <p>
                      {generating
                        ? "Generating with the selected AI model..."
                        : "Choose one or more garments and generate a preview."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="auto-studio-actions">
            <button
              className="auto-studio-primary"
              type="button"
              disabled={!result}
              onClick={downloadResult}
            >
              Download Result
            </button>

            <label
              className="auto-studio-secondary auto-studio-import"
            >
              Import generated result
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={!photo || !hasSelection || generating}
                onChange={importResult}
                aria-label="Import generated result"
              />
            </label>
          </div>

          <p className="auto-studio-disclaimer">
            AI-generated visualization, not an exact prediction
            of garment fit or size. External research models are
            used; results and availability may vary.
          </p>
        </section>
  );
}
