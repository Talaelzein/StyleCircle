
import { useEffect, useState } from "react";
import { API_URL, getResponseData } from "../services/api";

// Displays and uploads the photo of one clothing item.
export default function ClothingPhoto({ item, token }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [photoVersion, setPhotoVersion] = useState(0);

  // Load the private photo using the user's login token.
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";

    async function loadPhoto() {
      setPhotoUrl("");

      if (!item.imagePublicId && photoVersion === 0) {
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/api/images/clothing/${item._id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            },
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error("Could not load clothing photo");
        }

        const imageBlob = await response.blob();

        if (controller.signal.aborted) {
          return;
        }

        objectUrl = URL.createObjectURL(imageBlob);
        setPhotoUrl(objectUrl);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message);
        }
      }
    }

    loadPhoto();

    return () => {
      controller.abort();

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [item._id, item.imagePublicId, token, photoVersion]);

  // Select an image from the computer.
  function handleFileChange(event) {
    const file = event.target.files?.[0];

    setError("");
    setSuccess("");
    setSelectedFile(null);

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Please choose a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("The image must be smaller than 2 MB.");
      return;
    }

    setSelectedFile(file);
  }

  // Upload the selected image to Express and MongoDB.
  async function handleUpload(event) {
    event.preventDefault();

    if (!selectedFile) {
      setError("Please select an image first.");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();

      // Must match upload.single("image") in Express.
      formData.append("image", selectedFile);

      const response = await fetch(
        `${API_URL}/api/images/clothing/${item._id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        }
      );

      await getResponseData(response);

      setSelectedFile(null);
      setSuccess("Photo uploaded successfully!");

      // Reload the image from MongoDB.
      setPhotoVersion((previous) => previous + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="clothing-photo">
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={`Photo of ${item.name}`}
          style={{
            display: "block",
            width: "100%",
            maxWidth: "250px",
            height: "auto",
            borderRadius: "12px",
            marginBottom: "12px"
          }}
        />
      ) : (
        <p>No clothing photo yet.</p>
      )}

      <form onSubmit={handleUpload}>
        <label>
          {photoUrl ? "Change photo" : "Add photo"}

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
          />
        </label>

        <button
          type="submit"
          disabled={uploading || !selectedFile}
        >
          {uploading ? "Uploading..." : "Upload Photo"}
        </button>
      </form>

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
    </div>
  );
}
