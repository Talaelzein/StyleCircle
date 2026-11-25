
import { useState } from "react";
import ClothingPreview from "./ClothingPreview.jsx";
import { API_URL } from "../services/api";

function loadImage(url, external = false) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (external) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Image could not be loaded"));
    image.src = url;
  });
}

function drawContained(ctx, image, x, y, width, height) {
  const scale = Math.min(
    width / image.naturalWidth,
    height / image.naturalHeight
  );

  const w = image.naturalWidth * scale;
  const h = image.naturalHeight * scale;

  ctx.drawImage(
    image,
    x + (width - w) / 2,
    y + (height - h) / 2,
    w,
    h
  );
}

async function drawWardrobePhoto(
  ctx, item, token, x, y, width, height
) {
  let url = "";
  let ownedUrl = false;

  try {
    if (item.imagePublicId) {
      const response = await fetch(
        `${API_URL}/api/images/clothing/${item._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error("Private photo unavailable");
      }

      url = URL.createObjectURL(await response.blob());
      ownedUrl = true;
    } else if (item.imageUrl?.startsWith("https://")) {
      url = item.imageUrl;
    } else {
      return;
    }

    const image = await loadImage(url, !ownedUrl);

    drawContained(ctx, image, x, y, width, height);
  } catch {
    // Keep the item name if its image cannot be exported.
  } finally {
    if (ownedUrl && url) URL.revokeObjectURL(url);
  }
}

export default function StudioLookPreview({
  modelPhoto,
  items,
  token,
  view = "front",
  compact = false
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function exportLook() {
    if (!modelPhoto?.url || !items.length || saving) return;

    setSaving(true);
    setError("");

    try {
      const model = await loadImage(modelPhoto.url);
      const canvas = document.createElement("canvas");

      canvas.width = 1280;
      canvas.height = 1530;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Your browser cannot export this look.");
      }

      ctx.fillStyle = "#f9f5f0";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#8d273e";
      ctx.font = "bold 54px Georgia";
      ctx.fillText("StyleCircle", 65, 90);

      ctx.fillStyle = "#5b504a";
      ctx.font = "26px Arial";
      ctx.fillText("MY STYLED LOOKBOOK", 760, 91);

      ctx.fillStyle = "#e8ded7";
      ctx.fillRect(65, 140, 635, 1220);

      drawContained(ctx, model, 65, 140, 635, 1220);

      const cards = items.slice(0, 8);

      for (let i = 0; i < cards.length; i++) {
        const item = cards[i];
        const x = 750 + (i % 2) * 237;
        const y = 140 + Math.floor(i / 2) * 305;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, y, 215, 285);

        ctx.fillStyle = "#f4ebe5";
        ctx.fillRect(x + 9, y + 9, 197, 210);

        await drawWardrobePhoto(
          ctx, item, token,
          x + 9, y + 9, 197, 210
        );

        ctx.fillStyle = "#352926";
        ctx.font = "bold 17px Arial";

        const shortName =
          item.name.length > 21
            ? `${item.name.slice(0, 20)}…`
            : item.name;

        ctx.fillText(shortName, x + 12, y + 245);

        ctx.fillStyle = "#8d273e";
        ctx.font = "15px Arial";
        ctx.fillText(
          item.category || "Clothing",
          x + 12,
          y + 270
        );
      }

      ctx.fillStyle = "#5b504a";
      ctx.font = "20px Arial";

      ctx.fillText(
        `${view.toUpperCase()} PHOTO VIEW • ${cards.length} SELECTED PIECES`,
        65,
        1425
      );

      ctx.font = "17px Arial";
      ctx.fillText(
        "Outfit inspiration preview — garments are not digitally fitted.",
        65,
        1465
      );

      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );

      if (!blob) {
        throw new Error("Unable to save the styled look.");
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `stylecircle-look-${Date.now()}.png`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      setError(err.message || "Could not export the look.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 18,
        padding: 16,
        border: "1px solid #eadfd7",
        borderRadius: 16,
        background: "#fffaf6"
      }}
    >
      {!compact && (
        <>
          <h3
            style={{
              margin: "0 0 8px",
              fontFamily: "Georgia, serif",
              fontWeight: 400
            }}
          >
            Your styled lookbook
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(110px, 1fr) minmax(160px, 1fr)",
              gap: 12,
              alignItems: "stretch"
            }}
          >
            <div
              style={{
                background: "#e7ddd5",
                borderRadius: 12,
                overflow: "hidden",
                minHeight: 220
              }}
            >
              {modelPhoto?.url ? (
                <img
                  src={modelPhoto.url}
                  alt={`${view} model view`}
                  style={{
                    width: "100%",
                    height: "100%",
                    maxHeight: 410,
                    objectFit: "contain",
                    display: "block"
                  }}
                />
              ) : (
                <p style={{ padding: 12, fontSize: 13 }}>
                  Upload a model photo to complete the preview.
                </p>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, minmax(0, 1fr))",
                gap: 8,
                alignContent: "start"
              }}
            >
              {items.slice(0, 8).map((item) => (
                <div
                  key={item._id}
                  style={{
                    background: "white",
                    padding: 8,
                    borderRadius: 12,
                    border: "1px solid #eadfd7",
                    minWidth: 0,
                    textAlign: "center"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center"
                    }}
                  >
                    <ClothingPreview
                      item={item}
                      token={token}
                      size={80}
                    />
                  </div>

                  <div
                    title={item.name}
                    style={{
                      fontSize: 11,
                      marginTop: 6,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {item.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <p
        style={{
          fontSize: 12,
          margin: "12px 0",
          color: "#76665d"
        }}
      >
        A visual outfit board with your chosen pieces;
        this does not simulate garment fit.
      </p>

      <button
        type="button"
        className="s360-primary"
        disabled={!modelPhoto?.url || !items.length || saving}
        onClick={exportLook}
      >
        {saving
          ? "Preparing PNG…"
          : "↓ Export styled look PNG"}
      </button>

      {error && (
        <p role="alert" style={{ color: "#8d273e", fontSize: 12 }}>
          {error}
        </p>
      )}
    </div>
  );
}
