import { API_URL } from "./api.js";

function getStyleCircleToken() {
  try {
    const session = JSON.parse(
      sessionStorage.getItem("stylecircle_session") || "null"
    );

    if (typeof session?.token === "string" && session.token) {
      return session.token;
    }
  } catch {
    // The message below also covers corrupt browser session data.
  }

  throw new Error("Please log in to StyleCircle again.");
}

async function preparePersonImage(file) {
  const image = await createImageBitmap(file);

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 1024;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Image processing is unavailable.");
    }

    ctx.fillStyle = "#e3e3e3";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const scale = Math.min(
      canvas.width / image.width,
      canvas.height / image.height
    );

    const width = image.width * scale;
    const height = image.height * scale;

    ctx.drawImage(
      image,
      (canvas.width - width) / 2,
      (canvas.height - height) / 2,
      width,
      height
    );

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        blob =>
          blob
            ? resolve(blob)
            : reject(new Error("Could not prepare your photograph.")),
        "image/png"
      );
    });
  } finally {
    image.close();
  }
}

export async function generateTryOn({
  personImage,
  garments
}) {
  if (!personImage) {
    throw new Error("A person photo is required.");
  }

  if (!Array.isArray(garments) || garments.length === 0) {
    throw new Error("Select at least one garment.");
  }

  const token = getStyleCircleToken();
  const preparedPerson = await preparePersonImage(personImage);
  const form = new FormData();

  form.append("person", preparedPerson, "person.png");
  form.append(
    "items",
    JSON.stringify(
      garments.map(item => ({
        category: String(item.category || "").toLowerCase(),
        description: String(item.description || "").slice(0, 200)
      }))
    )
  );

  for (const item of garments) {
    form.append("garments", item.garmentImage, "garment.png");
  }

  const response = await fetch(`${API_URL}/api/try-on`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: form
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || `AI request failed (${response.status}).`
    );
  }

  if (typeof data.url !== "string" || !data.url.startsWith("https://")) {
    throw new Error("The AI service did not return an image.");
  }

  return data.url;
}
