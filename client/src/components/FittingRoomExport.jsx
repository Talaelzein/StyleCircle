
import { useState } from "react";
import { API_URL } from "../services/api";

// Convert an image URL into a drawable bitmap.
async function loadBitmap(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(
      "Could not load one of the images."
    );
  }

  const blob = await response.blob();

  return createImageBitmap(blob);
}

// Export canvas content as a PNG file.
function canvasToPng(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(
            new Error("Could not create the PNG image.")
          );
          return;
        }

        resolve(blob);
      },
      "image/png"
    );
  });
}

export default function FittingRoomExport({
  bodyPhoto,
  layers,
  clothes,
  token
}) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  async function handleExport() {
    if (!bodyPhoto?.url || layers.length === 0) {
      setError(
        "Add a full-body photo and at least one clothing item."
      );
      return;
    }

    setExporting(true);
    setError("");

    let backgroundBitmap = null;

    try {
      // Create a canvas for the final outfit.
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error(
          "Image exporting is not available."
        );
      }

      // Load the full-body photo from the browser.
      backgroundBitmap = await loadBitmap(
        bodyPhoto.url
      );

      // Keep the same proportions while reducing
      // extremely large photos to a reasonable size.
      const maxDimension = 1600;

      const scale = Math.min(
        1,
        maxDimension /
          Math.max(
            backgroundBitmap.width,
            backgroundBitmap.height
          )
      );

      canvas.width = Math.max(
        1,
        Math.round(
          backgroundBitmap.width * scale
        )
      );

      canvas.height = Math.max(
        1,
        Math.round(
          backgroundBitmap.height * scale
        )
      );

      // Draw the original full-body photograph.
      context.drawImage(
        backgroundBitmap,
        0,
        0,
        canvas.width,
        canvas.height
      );

      // Draw clothing in the same order as the
      // layers displayed in the fitting room.
      for (const layer of layers) {
        const item = clothes.find(
          (piece) => piece._id === layer.itemId
        );

        if (!item || !item.imagePublicId) {
          throw new Error(
            "A clothing photo is missing. Remove that layer and try again."
          );
        }

        const imageBitmap = await loadBitmap(
          `${API_URL}/api/images/clothing/${item._id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        try {
          // Reproduce the on-screen percentage positions.
          const x = (layer.x / 100) * canvas.width;
          const y = (layer.y / 100) * canvas.height;

          const width =
            (layer.width / 100) * canvas.width;

          // Preserve each clothing photo's proportions.
          const height =
            width *
            (imageBitmap.height / imageBitmap.width);

          context.drawImage(
            imageBitmap,
            x,
            y,
            width,
            height
          );
        } finally {
          imageBitmap.close();
        }
      }

      // Turn the finished image into a PNG.
      const pngBlob = await canvasToPng(canvas);

      const downloadUrl =
        URL.createObjectURL(pngBlob);

      try {
        const link = document.createElement("a");

        link.href = downloadUrl;
        link.download =
          "StyleCircle-Fitting-Room.png";

        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        // Allow the browser to begin the download
        // before releasing the temporary URL.
        setTimeout(() => {
          URL.revokeObjectURL(downloadUrl);
        }, 1000);
      }
    } catch (err) {
      setError(
        err.message || "Could not export the preview."
      );
    } finally {
      if (backgroundBitmap) {
        backgroundBitmap.close();
      }

      setExporting(false);
    }
  }

  return (
    <div
      style={{
        marginTop: "16px",
        marginBottom: "20px"
      }}
    >
      <button
        type="button"
        onClick={handleExport}
        disabled={
          exporting ||
          !bodyPhoto ||
          layers.length === 0
        }
      >
        {exporting
          ? "Creating PNG..."
          : "Download Fitting Room Preview"}
      </button>

      <p>
        Your preview will be saved as a PNG.
        Your full-body photo stays in your browser.
      </p>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
