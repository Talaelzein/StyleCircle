
import { useEffect, useState } from "react";
import { API_URL } from "../services/api";

export default function ClothingPreview({
  item,
  token,
  size = 100
}) {
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";

    setImageUrl("");

    if (!item?._id || !item.imagePublicId) {
      if(item?.imageUrl?.startsWith("https://")) setImageUrl(item.imageUrl);
      return () => controller.abort();
    }

    async function loadImage() {
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

        if (!response.ok) return;

        const blob = await response.blob();

        if (controller.signal.aborted) return;

        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(
            "Could not load clothing preview:",
            error
          );
        }
      }
    }

    loadImage();

    return () => {
      controller.abort();

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [item?._id, item?.imagePublicId, item?.imageUrl, token]);

  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "12px",
        overflow: "hidden",
        background: "#f3f0f5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={item.name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover"
          }}
        />
      ) : (
        <span
          aria-label="No clothing photo"
          style={{ fontSize: "30px" }}
        >
          👕
        </span>
      )}
    </div>
  );
}
