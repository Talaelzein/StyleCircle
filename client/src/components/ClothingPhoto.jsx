
import { useEffect, useRef, useState } from "react";

import {
  API_URL,
  getResponseData
} from "../services/api";

import {
  compressImage,
  formatFileSize,
  MAX_ORIGINAL_SIZE
} from "../utils/compressImage.js";

export default function ClothingPhoto({ item, token }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [processing, setProcessing] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [compressionInfo, setCompressionInfo] =
    useState(null);

  const [photoVersion, setPhotoVersion] = useState(0);
  const [localRemoved,setLocalRemoved] = useState(false);
  const fileInputRef = useRef(null);

  // Retrieve the private photo from the backend.
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";

    async function loadPhoto() {
      setPhotoUrl("");
      if(localRemoved) return;

      if (!item.imagePublicId && photoVersion === 0) {
        if(item.imageUrl?.startsWith("https://")) setPhotoUrl(item.imageUrl);
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
          throw new Error(
            "Could not load clothing photo."
          );
        }

        const blob = await response.blob();

        if (controller.signal.aborted) return;

        objectUrl = URL.createObjectURL(blob);
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
  }, [
    item._id,
    item.imagePublicId,
    item.imageUrl,
    token,
    photoVersion,
    localRemoved
  ]);

  function handleFileChange(event) {
    const file = event.target.files?.[0];

    setError("");
    setSuccess("");
    setCompressionInfo(null);
    setSelectedFile(null);

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(
        "Please choose a JPG, PNG, or WebP image."
      );
      return;
    }

    if (file.size > MAX_ORIGINAL_SIZE) {
      setError(
        "Please choose a photo smaller than 10 MB."
      );
      return;
    }

    setSelectedFile(file);
  }

  async function handleUpload(event) {
    event.preventDefault();

    if (!selectedFile || processing) return;

    setError("");
    setSuccess("");
    setCompressionInfo(null);

    try {
      // First compress the original image.
      setProcessing("compressing");

      const compressed = await compressImage(
        selectedFile
      );

      setCompressionInfo({
        originalSize: compressed.originalSize,
        compressedSize: compressed.compressedSize,
        width: compressed.width,
        height: compressed.height
      });

      // Then upload the smaller WebP image.
      setProcessing("uploading");

      const formData = new FormData();

      formData.append(
        "image",
        compressed.file
      );

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

      setSuccess(
        "Photo compressed and uploaded successfully!"
      );

      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setLocalRemoved(false);
      // Refresh the photo from MongoDB.
      setPhotoVersion(
        (previous) => previous + 1
      );
    } catch (err) {
      setError(
        err.message || "Could not upload photo."
      );
    } finally {
      setProcessing("");
    }
  }


  async function removePhoto() {
    if (!window.confirm("Remove this clothing photo? The item will stay in your closet.")) return;
    setError("");setSuccess("");setProcessing("removing");
    try {
      const response=await fetch(`${API_URL}/api/images/clothing/${item._id}`,{method:"DELETE",headers:{Authorization:`Bearer ${token}`}});
      if(!response.ok) await getResponseData(response);
      setLocalRemoved(true);setPhotoUrl("");setSuccess("Photo removed. Refresh the closet to update the item.");
    } catch(e) {setError(e.message);} finally {setProcessing("");}
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

      {photoUrl && <button type="button" disabled={Boolean(processing)} onClick={removePhoto}>Remove Photo</button>}
      <form onSubmit={handleUpload}>
        <label>
          {photoUrl
            ? "Change photo"
            : "Add photo"}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture={undefined}
            onChange={handleFileChange}
            disabled={Boolean(processing)}
          />
        </label>

        {selectedFile && (
          <p>
            Selected: {selectedFile.name}
            {" — "}
            {formatFileSize(selectedFile.size)}
          </p>
        )}

        <button
          type="submit"
          disabled={
            Boolean(processing) ||
            !selectedFile
          }
        >
          {processing === "compressing"
            ? "Compressing..."
            : processing === "uploading"
              ? "Uploading..."
              : "Upload Photo"}
        </button>
      </form>
      <label style={{display:'block',marginTop:10,fontSize:'.78rem'}}>Take a photo using your phone camera
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handleFileChange} disabled={Boolean(processing)} style={{display:'block',marginTop:6}}/>
      </label>

      {compressionInfo && (
        <div>
          <p>
            Original size:{" "}
            {formatFileSize(
              compressionInfo.originalSize
            )}
          </p>

          <p>
            Compressed size:{" "}
            {formatFileSize(
              compressionInfo.compressedSize
            )}
          </p>

          <p>
            Image dimensions:{" "}
            {compressionInfo.width}
            {" × "}
            {compressionInfo.height}
          </p>
        </div>
      )}

      {processing && (
        <p role="status">
          {processing === "compressing"
            ? "Optimizing your photo..."
            : "Saving your photo to My Closet..."}
        </p>
      )}

      {error && (
        <p
          className="error"
          role="alert"
        >
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
