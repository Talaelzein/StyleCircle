
export const MAX_ORIGINAL_SIZE = 10 * 1024 * 1024;
export const MAX_UPLOAD_SIZE = 2 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.type !== "image/webp") {
          reject(
            new Error(
              "Your browser could not create a WebP image."
            )
          );
          return;
        }

        resolve(blob);
      },
      "image/webp",
      quality
    );
  });
}

export async function compressImage(file) {
  if (!file) {
    throw new Error("Please select a photo.");
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(
      "Please choose a JPG, PNG, or WebP photo."
    );
  }

  if (file.size > MAX_ORIGINAL_SIZE) {
    throw new Error(
      "The original photo must be 10 MB or smaller."
    );
  }

  let bitmap;

  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      "This photo could not be opened. Try another image."
    );
  }

  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error(
        "Image compression is unavailable in this browser."
      );
    }

    // Try smaller dimensions if needed.
    const maximumDimensions = [
      1200,
      1000,
      800,
      640,
      480
    ];

    const qualities = [0.85, 0.7, 0.55, 0.4];

    for (const maxDimension of maximumDimensions) {
      const scale = Math.min(
        1,
        maxDimension /
          Math.max(bitmap.width, bitmap.height)
      );

      canvas.width = Math.max(
        1,
        Math.round(bitmap.width * scale)
      );

      canvas.height = Math.max(
        1,
        Math.round(bitmap.height * scale)
      );

      context.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      context.drawImage(
        bitmap,
        0,
        0,
        canvas.width,
        canvas.height
      );

      for (const quality of qualities) {
        const blob = await canvasToBlob(
          canvas,
          quality
        );

        if (blob.size <= MAX_UPLOAD_SIZE) {
          const name =
            file.name.replace(/\.[^.]+$/, "") +
            ".webp";

          return {
            file: new File(
              [blob],
              name,
              { type: "image/webp" }
            ),
            originalSize: file.size,
            compressedSize: blob.size,
            width: canvas.width,
            height: canvas.height
          };
        }
      }
    }

    throw new Error(
      "The photo is still too large after compression."
    );
  } finally {
    bitmap.close();
  }
}

export function formatFileSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
