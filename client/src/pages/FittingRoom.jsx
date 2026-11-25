
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ClothingPreview from "../components/ClothingPreview.jsx";
import { API_URL, getResponseData } from "../services/api";

const ANGLES = [
  { id: "front", name: "Front", degree: "0°" },
  { id: "right", name: "Right", degree: "90°" },
  { id: "back", name: "Back", degree: "180°" },
  { id: "left", name: "Left", degree: "270°" }
];

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO = 15 * 1024 * 1024;

// Save model photos locally so they survive a refresh.
function openPhotoDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("stylecircle-studio-v1", 1);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("photos")) {
        request.result.createObjectStore("photos");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function photoStorage(action, key, blob) {
  const db = await openPhotoDB();

  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(
        "photos",
        action === "get" ? "readonly" : "readwrite"
      );

      const store = tx.objectStore("photos");

      const request =
        action === "put"
          ? store.put(blob, key)
          : action === "delete"
            ? store.delete(key)
            : store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function ownerKey(token) {
  try {
    const chunk = token.split(".")[1];

    const payload = JSON.parse(
      atob(
        chunk
          .replace(/-/g, "+")
          .replace(/_/g, "/")
      )
    );

    return String(
      payload.sub ||
      payload.userId ||
      payload.id ||
      "local"
    ).slice(0, 100);
  } catch {
    return "local";
  }
}

// Default garment positions on a front-facing model.
function placementFor(category) {
  const c = String(category || "").toLowerCase();

  if (c === "top") {
    return { x: 30, y: 18, w: 40, h: 34 };
  }

  if (c === "bottom") {
    return { x: 29, y: 43, w: 43, h: 43 };
  }

  if (c === "dress") {
    return { x: 27, y: 18, w: 46, h: 68 };
  }

  if (c === "outerwear") {
    return { x: 26, y: 17, w: 48, h: 46 };
  }

  if (c === "shoes") {
    return { x: 26, y: 84, w: 48, h: 14 };
  }

  if (c === "bag") {
    return { x: 62, y: 38, w: 28, h: 25 };
  }

  if (c === "glasses") {
    return { x: 41, y: 9, w: 18, h: 10 };
  }

  if (c === "jewelry") {
    return { x: 41, y: 20, w: 18, h: 14 };
  }

  return { x: 40, y: 25, w: 24, h: 24 };
}

function clamp(number, min, max) {
  return Math.max(min, Math.min(max, number));
}

function loadImage(url, external = false) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    if (external) {
      image.crossOrigin = "anonymous";
    }

    image.onload = () => resolve(image);

    image.onerror = () => {
      reject(new Error("One of the photos could not be loaded."));
    };

    image.src = url;
  });
}

function drawFit(ctx, image, x, y, w, h) {
  const scale = Math.min(
    w / image.naturalWidth,
    h / image.naturalHeight
  );

  const iw = image.naturalWidth * scale;
  const ih = image.naturalHeight * scale;

  const bounds = {
    x: x + (w - iw) / 2,
    y: y + (h - ih) / 2,
    w: iw,
    h: ih
  };

  ctx.drawImage(
    image,
    bounds.x,
    bounds.y,
    iw,
    ih
  );

  return bounds;
}

// Best-effort background cleanup for light product photos.
// Transparent garment PNGs still give the best results.
async function garmentURL(blob) {
  const source = URL.createObjectURL(blob);

  try {
    const image = await loadImage(source);

    const scale = Math.min(
      1,
      750 / Math.max(
        image.naturalWidth,
        image.naturalHeight
      )
    );

    const w = Math.max(
      1,
      Math.round(image.naturalWidth * scale)
    );

    const h = Math.max(
      1,
      Math.round(image.naturalHeight * scale)
    );

    const canvas = document.createElement("canvas");

    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext(
      "2d",
      { willReadFrequently: true }
    );

    if (!ctx) {
      return URL.createObjectURL(blob);
    }

    ctx.drawImage(image, 0, 0, w, h);

    const pixels = ctx.getImageData(0, 0, w, h);
    const data = pixels.data;

    const visited = new Uint8Array(w * h);
    const queue = new Int32Array(w * h);

    let head = 0;
    let tail = 0;

    const isLight = (i) => {
      const n = i * 4;

      const r = data[n];
      const g = data[n + 1];
      const b = data[n + 2];

      return (
        data[n + 3] > 0 &&
        r > 213 &&
        g > 206 &&
        b > 196 &&
        Math.max(r, g, b) -
          Math.min(r, g, b) < 54
      );
    };

    const add = (i) => {
      if (!visited[i] && isLight(i)) {
        visited[i] = 1;
        queue[tail++] = i;
      }
    };

    for (let x = 0; x < w; x++) {
      add(x);
      add((h - 1) * w + x);
    }

    for (let y = 0; y < h; y++) {
      add(y * w);
      add(y * w + w - 1);
    }

    while (head < tail) {
      const i = queue[head++];

      const x = i % w;
      const y = (i / w) | 0;

      data[i * 4 + 3] = 0;

      if (x > 0) add(i - 1);
      if (x < w - 1) add(i + 1);
      if (y > 0) add(i - w);
      if (y < h - 1) add(i + w);
    }

    if (
      tail > 0 &&
      tail < w * h * 0.92
    ) {
      ctx.putImageData(pixels, 0, 0);

      const result = await new Promise((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });

      if (result) {
        return URL.createObjectURL(result);
      }
    }

    return URL.createObjectURL(blob);
  } finally {
    URL.revokeObjectURL(source);
  }
}

function UploadCard({
  angle,
  photo,
  onUpload,
  onRemove,
  disabled
}) {
  return (
    <div className="s360-upload-item">
      <label className="s360-photo-input">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled}
          onChange={(event) =>
            onUpload(angle.id, event)
          }
        />

        {photo ? (
          <img
            src={photo.url}
            alt={`${angle.name} view`}
          />
        ) : (
          <span className="s360-upload-empty">
            <b>+</b>
            Add {angle.name.toLowerCase()} photo
          </span>
        )}
      </label>

      {photo && (
        <button
          type="button"
          className="s360-delete-photo"
          aria-label={`Remove ${angle.name} photo`}
          onClick={() => onRemove(angle.id)}
        >
          ×
        </button>
      )}

      <div className="s360-upload-caption">
        {angle.name} view{" "}
        {photo && <span className="s360-check">✓</span>}
      </div>
    </div>
  );
}

const studioCSS = `
.s360 {
  max-width: 1570px;
  margin: auto;
  padding: 32px 28px 60px;
  color: #27201e;
  font-family: inherit;
}

.s360, .s360 * {
  box-sizing: border-box;
}

.s360 button {
  cursor: pointer;
}

.s360 button:disabled {
  cursor: not-allowed;
  opacity: .48;
}

.s360 h1,
.s360 h2,
.s360 h3 {
  font-family: Georgia, 'Times New Roman', serif;
  letter-spacing: -.035em;
  font-weight: 400;
  color: #241b19;
}

.s360 h1 {
  font-size: clamp(36px, 3.6vw, 54px);
  margin: 0 0 16px;
}

.s360 h2 {
  font-size: 26px;
  margin: 24px 0 16px;
}

.s360-grid {
  display: grid;
  grid-template-columns:
    minmax(280px, 375px)
    minmax(390px, 1fr)
    118px;
  gap: 25px;
  align-items: start;
}

.s360-left {
  border: 1px solid #e7dcd5;
  border-radius: 22px;
  background: #fffdf9;
  padding: 25px 20px;
  min-height: 730px;
}

.s360-lead {
  font-size: 16px;
  line-height: 1.65;
  color: #6d5d56;
  margin: 0 0 23px;
}

.s360-steps {
  border-bottom: 1px solid #ebe2dc;
  padding-bottom: 19px;
}

.s360-step {
  display: flex;
  gap: 13px;
  align-items: center;
  font-size: 14px;
  padding: 6px 0;
}

.s360-step b {
  display: grid;
  place-items: center;
  border: 1px solid #d7c8be;
  border-radius: 50%;
  width: 34px;
  height: 34px;
  font-weight: 400;
  flex: none;
}

.s360-step:first-child b {
  background: #8d273e;
  color: white;
  border-color: #8d273e;
}

.s360-uploads {
  display: grid;
  grid-template-columns:
    repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.s360-upload-item {
  position: relative;
  min-width: 0;
}

.s360-photo-input {
  height: 190px;
  border-radius: 14px;
  background: #eae1da;
  display: block;
  overflow: hidden;
  cursor: pointer;
  position: relative;
}

.s360-photo-input input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.s360-photo-input img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
}

.s360-upload-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 7px;
  color: #82695d;
  font-size: 12px;
  text-align: center;
  padding: 7px;
}

.s360-upload-empty b {
  display: grid;
  place-items: center;
  background: #fcf8f4;
  border-radius: 50%;
  width: 45px;
  height: 45px;
  font-size: 25px;
  font-weight: 400;
}

.s360-upload-caption {
  text-align: center;
  padding-top: 9px;
  font-size: 13px;
}

.s360-check {
  color: #38874c;
  font-weight: 700;
}

.s360-delete-photo {
  position: absolute;
  top: 6px;
  right: 6px;
  border: 0;
  border-radius: 9px;
  width: 30px;
  height: 30px;
  background: #fffcf6;
  font-size: 22px;
}

.s360-help {
  border: 1px solid #e7dcd5;
  border-radius: 12px;
  margin-top: 15px;
  padding: 10px;
  font-size: 13px;
  color: #63544d;
}

.s360-help summary {
  cursor: pointer;
  font-weight: 700;
}

.s360-help p {
  line-height: 1.5;
}

.s360-help .s360-photo-input {
  height: 130px;
}

.s360-primary {
  background: #8d273e;
  color: white;
  border: 0;
  border-radius: 26px;
  padding: 13px 20px;
  min-height: 47px;
  font-size: 14px;
  font-weight: 700;
}

.s360-create {
  margin-top: 22px;
  width: 100%;
}

.s360-privacy,
.s360-note {
  font-size: 12px;
  line-height: 1.6;
  color: #87766c;
}

.s360-center {
  min-width: 0;
}

.s360-stage {
  height: min(63vw, 740px);
  min-height: 570px;
  background: #dad0c8;
  border-radius: 20px;
  overflow: hidden;
  position: relative;
  display: grid;
  place-items: center;
  isolation: isolate;
}

.s360-stage:fullscreen {
  height: 100vh;
  border-radius: 0;
}

.s360-stage-photo {
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  pointer-events: none;
}

.s360-placeholder {
  text-align: center;
  padding: 28px;
  color: #756257;
  max-width: 340px;
}

.s360-placeholder b {
  display: block;
  font-family: Georgia, serif;
  font-size: 30px;
  font-weight: 400;
  margin-bottom: 12px;
}

.s360-view-badge {
  position: absolute;
  top: 17px;
  left: 17px;
  z-index: 4;
  border-radius: 30px;
  background: #fffaf4eb;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 700;
}

.s360-fullscreen {
  position: absolute;
  top: 16px;
  right: 17px;
  z-index: 6;
  border: 0;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  background: #fffaf4ef;
  font-size: 20px;
}

.s360-zoom {
  position: absolute;
  right: 15px;
  bottom: 104px;
  z-index: 5;
  display: grid;
  gap: 6px;
}

.s360-zoom button {
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  background: #fffbf6eb;
  font-size: 21px;
}

.s360-player {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 12px;
  background:
    linear-gradient(0deg, #d6cbc3f5, #d6cbc3bd);
  padding: 14px 20px;
}

.s360-player button {
  width: 42px;
  height: 42px;
  flex: none;
  border: 0;
  border-radius: 50%;
  background: #fffaf5;
  font-size: 23px;
}

.s360-player input {
  width: 100%;
  accent-color: #8d273e;
}

.s360-angle-box {
  border: 1px solid #e9ded8;
  border-radius: 17px;
  padding: 11px 8px;
}

.s360-angle-box h3 {
  font-size: 20px;
  text-align: center;
  margin: 4px 0 14px;
}

.s360-angle {
  position: relative;
  width: 100%;
  border: 2px solid transparent;
  background: #eae1da;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 9px;
  padding: 0;
  display: block;
}

.s360-angle.active {
  border-color: #8d273e;
}

.s360-angle img {
  width: 100%;
  height: 115px;
  object-fit: cover;
  object-position: center top;
  display: block;
}

.s360-angle-empty {
  height: 115px;
  display: grid;
  place-items: center;
  font-size: 12px;
  color: #806a5d;
}

.s360-angle-label {
  display: block;
  font-size: 11px;
  background: #fffaf5eb;
  padding: 4px;
  text-align: center;
}

.s360-tabs {
  border: 1px solid #e4d7cf;
  border-radius: 35px;
  background: #fffdf9;
  padding: 5px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
  max-width: 680px;
  margin: 24px auto 0;
}

.s360-tabs button {
  border: 0;
  border-radius: 25px;
  background: none;
  min-height: 47px;
  font-size: 14px;
  color: #3a302b;
}

.s360-tabs button.active {
  background: #8d273e;
  color: white;
}

.s360-lower {
  border: 1px solid #e6dad3;
  border-radius: 17px;
  background: #fffaf6;
  margin-top: 17px;
  padding: 19px;
}

.s360-lower h3 {
  font-size: 25px;
  margin: 0 0 7px;
}

.s360-lower p {
  font-size: 13px;
  line-height: 1.6;
  color: #706057;
  margin: 9px 0;
}

.s360-row {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  align-items: center;
  margin-top: 12px;
}

.s360-outline {
  background: transparent;
  border: 1px solid #ae9688;
  border-radius: 24px;
  padding: 10px 13px;
  font-size: 13px;
  color: #432d30;
}

.s360-closet-grid {
  display: grid;
  grid-template-columns:
    repeat(auto-fill, minmax(91px, 1fr));
  gap: 9px;
  margin-top: 14px;
  max-height: 250px;
  overflow: auto;
}

.s360-closet-item {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 5px;
  border: 1px solid #e7ddd4;
  border-radius: 13px;
  padding: 6px;
  background: white;
  min-width: 0;
}

.s360-closet-item.active {
  border: 2px solid #8d273e;
  background: #fff1f2;
}

.s360-closet-item span {
  max-width: 100%;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}

.s360-controls {
  margin-top: 15px;
  padding: 14px;
  background: #f5ece6;
  border-radius: 14px;
}

.s360-controls label {
  display: grid;
  grid-template-columns: 90px 1fr 40px;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 12px;
}

.s360-controls input[type=range] {
  width: 100%;
  accent-color: #8d273e;
}

.s360-controls select {
  width: 100%;
  min-height: 38px;
  border: 1px solid #d8c6bd;
  border-radius: 9px;
  background: white;
  padding: 5px;
}

.s360-onbody {
  position: absolute;
  z-index: 3;
  touch-action: none;
  border: 1px dashed transparent;
  cursor: grab;
  display: grid;
  place-items: center;
  pointer-events: auto;
}

.s360-onbody.active {
  border: 2px dashed #8d273e;
  background: #8d273e14;
}

.s360-onbody:active {
  cursor: grabbing;
}

.s360-onbody img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}

.s360-onbody .s360-grab {
  position: absolute;
  right: -8px;
  bottom: -8px;
  background: #8d273e;
  color: white;
  font-size: 11px;
  border-radius: 11px;
  padding: 3px 6px;
  pointer-events: none;
}

.s360-alert {
  padding: 12px 15px;
  border-radius: 12px;
  background: #f8e1e4;
  color: #823248;
  font-size: 13px;
  margin-top: 14px;
}

.s360-success {
  background: #e8f1e5;
  color: #355b3c;
}

.s360-note {
  text-align: center;
  margin-top: 18px;
}

@media (max-width: 1120px) {
  .s360-grid {
    grid-template-columns:
      minmax(245px, 330px)
      minmax(0, 1fr);
    gap: 15px;
  }

  .s360-angle-box {
    grid-column: 2;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 7px;
  }

  .s360-angle-box h3 {
    grid-column: 1 / -1;
  }

  .s360-stage {
    height: 64vw;
  }

  .s360-angle {
    margin: 0;
  }

  .s360-angle img,
  .s360-angle-empty {
    height: 90px;
  }
}

@media (max-width: 720px) {
  .s360 {
    padding: 15px 10px 40px;
  }

  .s360-grid {
    display: flex;
    flex-direction: column;
  }

  .s360-left,
  .s360-center,
  .s360-angle-box {
    width: 100%;
    min-height: 0;
  }

  .s360-stage {
    height: 70vh;
    min-height: 460px;
  }

  .s360-angle-box {
    display: grid;
    grid-template-columns:
      repeat(4, minmax(0, 1fr));
  }

  .s360-angle-box h3 {
    grid-column: 1 / -1;
  }

  .s360-angle img,
  .s360-angle-empty {
    height: 90px;
  }

  .s360-photo-input {
    height: 155px;
  }

  .s360-tabs button {
    font-size: 12px;
  }
}
`;

export default function FittingRoom({ token }) {
  const account = ownerKey(token);

  const positionsKey =
    `stylecircle:studio:positions:${account}`;

  const [photos, setPhotos] = useState({
    front: null,
    right: null,
    back: null,
    left: null
  });

  const [restoring, setRestoring] = useState(true);
  const [view, setView] = useState("front");
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("my360");
  const [zoom, setZoom] = useState(1);

  const [clothes, setClothes] = useState([]);
  const [closetLoaded, setClosetLoaded] = useState(false);
  const [closetLoading, setClosetLoading] = useState(false);

  const [picked, setPicked] = useState([]);
  const [placements, setPlacements] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [garments, setGarments] = useState({});

  const [stageSize, setStageSize] = useState({
    w: 0,
    h: 0
  });

  const [photoSize, setPhotoSize] = useState({
    w: 0,
    h: 0
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const stageRef = useRef(null);
  const photoURLs = useRef(new Set());
  const garmentURLs = useRef(new Set());
  const garmentPending = useRef(new Set());
  const garmentCache = useRef(new Map());
  const mounted = useRef(true);
  const drag = useRef(null);

  function rememberPhotoURL(blob) {
    const url = URL.createObjectURL(blob);
    photoURLs.current.add(url);
    return url;
  }

  // Restore photos and clothing positions after refreshing.
  useEffect(() => {
    let cancelled = false;

    setRestoring(true);

    try {
      const saved = JSON.parse(
        localStorage.getItem(positionsKey) || "{}"
      );

      setPicked(
        Array.isArray(saved.picked)
          ? saved.picked
          : []
      );

      setPlacements(
        saved.placements &&
        typeof saved.placements === "object"
          ? saved.placements
          : {}
      );
    } catch {
      setPicked([]);
      setPlacements({});
    }

    async function restore() {
      try {
        const loaded = {};

        for (const angle of ANGLES) {
          const blob = await photoStorage(
            "get",
            `${account}:${angle.id}`
          );

          if (
            blob instanceof Blob &&
            !cancelled
          ) {
            loaded[angle.id] = {
              url: rememberPhotoURL(blob),
              blob
            };
          }
        }

        if (!cancelled) {
          setPhotos((old) => ({
            ...old,
            ...loaded
          }));
        }
      } catch {
        if (!cancelled) {
          setError(
            "Photo storage is unavailable in this browser. Photos will last until you refresh."
          );
        }
      } finally {
        if (!cancelled) {
          setRestoring(false);
        }
      }
    }

    restore();

    return () => {
      cancelled = true;
    };
  }, [account, positionsKey]);

  useEffect(() => {
    try {
      localStorage.setItem(
        positionsKey,
        JSON.stringify({
          picked,
          placements
        })
      );
    } catch {
      // Browser storage may be disabled.
    }
  }, [positionsKey, picked, placements]);

  useEffect(() => {
    const node = stageRef.current;

    if (!node) return;

    const observer = new ResizeObserver(() => {
      const box = node.getBoundingClientRect();

      setStageSize({
        w: box.width,
        h: box.height
      });
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;

      for (const url of photoURLs.current) {
        URL.revokeObjectURL(url);
      }

      for (const url of garmentURLs.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  // Load the user's actual wardrobe.
  useEffect(() => {
    if (
      (tab !== "outfits" && picked.length === 0) ||
      closetLoaded ||
      !token
    ) {
      return;
    }

    const controller = new AbortController();

    setClosetLoading(true);

    fetch(`${API_URL}/api/clothing-items`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      signal: controller.signal
    })
      .then(getResponseData)
      .then((data) => {
        if (!controller.signal.aborted) {
          setClothes(data.items || []);
          setClosetLoaded(true);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(
            e.message || "Could not load My Closet."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setClosetLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    tab,
    picked.length,
    closetLoaded,
    token
  ]);

  const selectedItems = clothes.filter(
    (item) => picked.includes(item._id)
  );

  const selectedKey = selectedItems
    .map((item) => item._id)
    .join("|");

  // Fetch private garment photos for the fitting preview.
  useEffect(() => {
    for (const item of selectedItems) {
      if (
        garmentCache.current.has(item._id) ||
        garmentPending.current.has(item._id)
      ) {
        continue;
      }

      garmentPending.current.add(item._id);

      (async () => {
        let url;

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
              throw new Error(
                "Clothing photo unavailable"
              );
            }

            url = await garmentURL(
              await response.blob()
            );
          } else if (
            /^https:\/\//i.test(item.imageUrl || "")
          ) {
            url = item.imageUrl;
          } else {
            throw new Error(
              "This item has no photo"
            );
          }

          if (!mounted.current) {
            if (url.startsWith("blob:")) {
              URL.revokeObjectURL(url);
            }

            return;
          }

          if (url.startsWith("blob:")) {
            garmentURLs.current.add(url);
          }

          garmentCache.current.set(item._id, url);

          setGarments((old) => ({
            ...old,
            [item._id]: url
          }));
        } catch {
          if (mounted.current) {
            setError(
              `Could not load the photo for ${item.name}.`
            );
          }
        } finally {
          garmentPending.current.delete(item._id);
        }
      })();
    }
  }, [selectedKey, clothes, token]);

  function positionOf(item) {
    return (
      placements[item._id] ||
      placementFor(item.category)
    );
  }

  async function upload(which, event) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    if (
      !TYPES.includes(file.type) ||
      file.size > MAX_PHOTO
    ) {
      setError(
        "Choose a JPG, PNG or WebP photo under 15 MB."
      );

      return;
    }

    const url = rememberPhotoURL(file);
    const previous = photos[which];

    setPhotos((old) => ({
      ...old,
      [which]: {
        url,
        blob: file
      }
    }));

    setView(which);
    setZoom(1);
    setReady(false);
    setError("");
    setMessage("");

    try {
      await photoStorage(
        "put",
        `${account}:${which}`,
        file
      );

      setMessage(
        "Photo saved on this device. It will remain after refreshing."
      );
    } catch {
      setError(
        "Photo is visible, but couldn't be saved for refresh. Try a smaller file or a normal browser window."
      );
    }

    if (previous?.url) {
      setTimeout(() => {
        URL.revokeObjectURL(previous.url);
        photoURLs.current.delete(previous.url);
      }, 100);
    }
  }

  async function removePhoto(which) {
    const old = photos[which];

    setPhotos((p) => ({
      ...p,
      [which]: null
    }));

    if (view === which) {
      setView("front");
    }

    setReady(false);

    try {
      await photoStorage(
        "delete",
        `${account}:${which}`
      );
    } catch {
      setError(
        "Couldn't remove the saved photo from browser storage."
      );
    }

    if (old?.url) {
      setTimeout(() => {
        URL.revokeObjectURL(old.url);
        photoURLs.current.delete(old.url);
      }, 100);
    }
  }

  function togglePick(item) {
    if (
      !picked.includes(item._id) &&
      picked.length >= 5
    ) {
      setError(
        "Choose up to five clothing pieces at a time."
      );
      return;
    }

    setError("");

    setPicked((old) =>
      old.includes(item._id)
        ? old.filter((id) => id !== item._id)
        : [...old, item._id]
    );

    setActiveId(item._id);
    setView("front");
    setTab("outfits");
    setZoom(1);
  }

  function startDrag(event, item) {
    if (
      event.button !== undefined &&
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();

    event.currentTarget.setPointerCapture(
      event.pointerId
    );

    drag.current = {
      id: item._id,
      clientX: event.clientX,
      clientY: event.clientY,
      start: positionOf(item)
    };

    setActiveId(item._id);
  }

  function moveDrag(event) {
    const active = drag.current;

    if (
      !active ||
      active.id !==
        event.currentTarget.dataset.itemid ||
      !photoBox.w
    ) {
      return;
    }

    const dx =
      (event.clientX - active.clientX) *
      100 /
      photoBox.w;

    const dy =
      (event.clientY - active.clientY) *
      100 /
      photoBox.h;

    const p = active.start;

    setPlacements((old) => ({
      ...old,
      [active.id]: {
        ...p,
        x: clamp(
          p.x + dx,
          -5,
          100 - p.w + 5
        ),
        y: clamp(
          p.y + dy,
          -5,
          100 - p.h + 5
        )
      }
    }));
  }

  function stopDrag() {
    drag.current = null;
  }

  const activePhoto = photos[view];

  const availableAngles = ANGLES.filter(
    (angle) => photos[angle.id]
  );

  const angleIndex = Math.max(
    0,
    availableAngles.findIndex(
      (angle) => angle.id === view
    )
  );

  const hasOverlay =
    view === "front" &&
    !!photos.front &&
    selectedItems.length > 0;

  const photoScale =
    photoSize.w && photoSize.h
      ? Math.min(
          stageSize.w / photoSize.w,
          stageSize.h / photoSize.h
        )
      : 0;

  const photoBox = {
    w: photoSize.w * photoScale,
    h: photoSize.h * photoScale,
    left:
      (stageSize.w -
        photoSize.w * photoScale) / 2,
    top:
      (stageSize.h -
        photoSize.h * photoScale) / 2
  };

  function go(direction) {
    if (availableAngles.length < 2) {
      return;
    }

    const next =
      (angleIndex +
        direction +
        availableAngles.length) %
      availableAngles.length;

    setView(availableAngles[next].id);
    setZoom(1);
  }

  // Export the model with the clothing layers placed on top.
  async function exportLook() {
    if (!activePhoto || saving) return;

    setSaving(true);
    setError("");

    try {
      const image = await loadImage(
        activePhoto.url
      );

      const canvas =
        document.createElement("canvas");

      canvas.width = 1000;
      canvas.height = 1350;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error(
          "Canvas isn't supported."
        );
      }

      ctx.fillStyle = "#fbf6f1";
      ctx.fillRect(0, 0, 1000, 1350);

      ctx.fillStyle = "#8d273e";
      ctx.font = "bold 38px Georgia";

      ctx.fillText(
        "StyleCircle",
        35,
        53
      );

      const bound = drawFit(
        ctx,
        image,
        0,
        75,
        1000,
        1180
      );

      if (view === "front") {
        for (const item of selectedItems) {
          const src = garments[item._id];

          if (!src) continue;

          try {
            const cloth = await loadImage(
              src,
              src.startsWith("https:")
            );

            const p = positionOf(item);

            drawFit(
              ctx,
              cloth,
              bound.x +
                p.x / 100 * bound.w,
              bound.y +
                p.y / 100 * bound.h,
              p.w / 100 * bound.w,
              p.h / 100 * bound.h
            );
          } catch {
            // Export the remaining garments.
          }
        }
      }

      ctx.font = "17px Arial";
      ctx.fillStyle = "#68554f";

      ctx.fillText(
        `${view.toUpperCase()} VIEW · 2D STYLING PREVIEW`,
        35,
        1300
      );

      const blob = await new Promise(
        (resolve) => {
          canvas.toBlob(
            resolve,
            "image/png"
          );
        }
      );

      if (!blob) {
        throw new Error(
          "Couldn't export the PNG."
        );
      }

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        `stylecircle-studio-${Date.now()}.png`;

      document.body.append(link);
      link.click();
      link.remove();

      setTimeout(
        () => URL.revokeObjectURL(url),
        2000
      );

      setMessage(
        "Studio preview exported successfully."
      );
    } catch (e) {
      setError(
        e.message || "Export failed."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="s360">
      <style>{studioCSS}</style>

      <div className="s360-grid">
        {/* LEFT PANEL */}
        <aside className="s360-left">
          <h1>360° Studio</h1>

          <p className="s360-lead">
            Upload your photos, explore every
            available view, and style your own
            clothes directly on your front-view
            photo.
          </p>

          <div className="s360-steps">
            {[
              "Upload your photos",
              "Prepare your studio",
              "Dress your photo using My Closet"
            ].map((step, index) => (
              <div
                className="s360-step"
                key={step}
              >
                <b>{index + 1}</b>
                {step}
              </div>
            ))}
          </div>

          <h2>Your photos</h2>

          <div className="s360-uploads">
            {[
              ANGLES[0],
              ANGLES[2]
            ].map((angle) => (
              <UploadCard
                key={angle.id}
                angle={angle}
                photo={photos[angle.id]}
                onUpload={upload}
                onRemove={removePhoto}
                disabled={restoring}
              />
            ))}
          </div>

          <details className="s360-help">
            <summary>
              Optional side photos
            </summary>

            <p>
              Upload real left and right photos.
              The studio does not invent missing
              angles.
            </p>

            <div className="s360-uploads">
              {[
                ANGLES[1],
                ANGLES[3]
              ].map((angle) => (
                <UploadCard
                  key={angle.id}
                  angle={angle}
                  photo={photos[angle.id]}
                  onUpload={upload}
                  onRemove={removePhoto}
                  disabled={restoring}
                />
              ))}
            </div>
          </details>

          <button
            className="s360-primary s360-create"
            type="button"
            onClick={() => {
              if (!photos.front) {
                setError(
                  "Please upload a front photo first."
                );

                return;
              }

              setReady(true);
              setView("front");
              setError("");

              setMessage(
                "Your studio is ready. Choose Try Outfits to dress the model."
              );
            }}
          >
            ✧ &nbsp; Prepare My Studio
          </button>

          <p className="s360-privacy">
            Your uploaded model photos are saved
            locally in this browser. They are not
            sent to an AI provider or synced to
            other devices.
          </p>
        </aside>

        {/* CENTRAL VIEWER */}
        <div className="s360-center">
          <section
            className="s360-stage"
            ref={stageRef}
            aria-label="Virtual styling preview"
          >
            {activePhoto ? (
              <img
                className="s360-stage-photo"
                src={activePhoto.url}
                alt={`${view} model view`}
                style={{
                  transform: `scale(${zoom})`
                }}
                onLoad={(e) => {
                  if (view === "front") {
                    setPhotoSize({
                      w: e.currentTarget.naturalWidth,
                      h: e.currentTarget.naturalHeight
                    });
                  }
                }}
              />
            ) : (
              <div className="s360-placeholder">
                <b>
                  {restoring
                    ? "Restoring your saved photos…"
                    : "Your studio starts here"}
                </b>

                Upload a full-body front photograph
                to begin.
              </div>
            )}

            {/* CLOTHING DIRECTLY ON THE MODEL */}
            {hasOverlay && photoBox.w > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: photoBox.left,
                  top: photoBox.top,
                  width: photoBox.w,
                  height: photoBox.h,
                  transform: `scale(${zoom})`,
                  transformOrigin: "center",
                  zIndex: 3,
                  pointerEvents: "none"
                }}
              >
                {selectedItems.map((item) => {
                  const p = positionOf(item);

                  return (
                    <div
                      key={item._id}
                      data-itemid={item._id}
                      className={`s360-onbody ${
                        activeId === item._id
                          ? "active"
                          : ""
                      }`}
                      style={{
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        width: `${p.w}%`,
                        height: `${p.h}%`
                      }}
                      onPointerDown={(event) =>
                        startDrag(event, item)
                      }
                      onPointerMove={moveDrag}
                      onPointerUp={stopDrag}
                      onPointerCancel={stopDrag}
                    >
                      {garments[item._id] && (
                        <img
                          src={garments[item._id]}
                          alt={item.name}
                          draggable={false}
                        />
                      )}

                      {activeId === item._id && (
                        <span className="s360-grab">
                          drag
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="s360-view-badge">
              ◌ &nbsp;
              {view.toUpperCase()}
              {hasOverlay
                ? " · Outfit on model"
                : " · Photo view"}
            </div>

            <button
              type="button"
              className="s360-fullscreen"
              aria-label="Fullscreen"
              onClick={() =>
                document.fullscreenElement
                  ? document.exitFullscreen()
                  : stageRef.current?.requestFullscreen?.()
              }
            >
              ⛶
            </button>

            <div className="s360-zoom">
              <button
                type="button"
                onClick={() =>
                  setZoom((z) =>
                    Math.min(
                      2,
                      +(z + 0.1).toFixed(2)
                    )
                  )
                }
              >
                +
              </button>

              <button
                type="button"
                onClick={() =>
                  setZoom((z) =>
                    Math.max(
                      1,
                      +(z - 0.1).toFixed(2)
                    )
                  )
                }
              >
                −
              </button>

              <button
                type="button"
                onClick={() => setZoom(1)}
              >
                ↻
              </button>
            </div>

            <div className="s360-player">
              <button
                type="button"
                onClick={() => go(-1)}
                disabled={
                  availableAngles.length < 2
                }
              >
                ‹
              </button>

              <input
                aria-label="Choose photo angle"
                type="range"
                min="0"
                max={Math.max(
                  0,
                  availableAngles.length - 1
                )}
                value={angleIndex}
                disabled={
                  availableAngles.length < 2
                }
                onChange={(e) => {
                  setView(
                    availableAngles[
                      Number(e.target.value)
                    ].id
                  );

                  setZoom(1);
                }}
              />

              <button
                type="button"
                onClick={() => go(1)}
                disabled={
                  availableAngles.length < 2
                }
              >
                ›
              </button>
            </div>
          </section>

          {/* BOTTOM NAVIGATION */}
          <div
            className="s360-tabs"
            role="tablist"
            aria-label="Studio sections"
          >
            {[
              ["my360", "My Studio"],
              ["outfits", "Try Outfits"],
              ["save", "Save & Share"]
            ].map(([id, label]) => (
              <button
                type="button"
                role="tab"
                key={id}
                className={
                  tab === id ? "active" : ""
                }
                aria-selected={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* MY STUDIO */}
          {tab === "my360" && (
            <div className="s360-lower">
              <h3>Made for your look</h3>

              <p>
                {ready
                  ? "Your studio is ready. Photos stay available after refresh on this browser."
                  : "Upload front and back photos and prepare the studio."}
              </p>

              <div className="s360-row">
                <button
                  className="s360-outline"
                  type="button"
                  disabled={!photos.front}
                  onClick={() =>
                    setView("front")
                  }
                >
                  Front view
                </button>

                <button
                  className="s360-outline"
                  type="button"
                  disabled={!photos.back}
                  onClick={() =>
                    setView("back")
                  }
                >
                  Back view
                </button>

                <button
                  className="s360-primary"
                  type="button"
                  onClick={() => {
                    setTab("outfits");
                    setView("front");
                  }}
                >
                  Try clothes on model
                </button>
              </div>
            </div>
          )}

          {/* TRY OUTFITS */}
          {tab === "outfits" && (
            <div className="s360-lower">
              <h3>Dress your model</h3>

              <p>
                Click an item to put it directly
                over the front photo. Drag the
                garment to position it, then adjust
                its size and position below.
                Transparent-background clothing
                photos work best.
              </p>

              {closetLoading && (
                <p>Loading your wardrobe…</p>
              )}

              {!closetLoading &&
                closetLoaded &&
                clothes.length === 0 && (
                  <p>
                    No clothes yet.{" "}
                    <Link to="/wardrobe">
                      Add some in My Closet.
                    </Link>
                  </p>
                )}

              <div className="s360-closet-grid">
                {clothes
                  .filter(
                    (item) =>
                      item.imagePublicId ||
                      item.imageUrl
                  )
                  .map((item) => (
                    <button
                      type="button"
                      key={item._id}
                      className={`s360-closet-item ${
                        picked.includes(item._id)
                          ? "active"
                          : ""
                      }`}
                      aria-pressed={
                        picked.includes(item._id)
                      }
                      onClick={() =>
                        togglePick(item)
                      }
                    >
                      <ClothingPreview
                        item={item}
                        token={token}
                        size={76}
                      />

                      <span title={item.name}>
                        {item.name}
                      </span>
                    </button>
                  ))}
              </div>

              <p>
                {selectedItems.length} of 5
                items selected.
                {view !== "front" &&
                  " Clothing placement is available in front view only."}
              </p>

              {selectedItems.length > 0 && (
                <div className="s360-controls">
                  <h3
                    style={{
                      fontSize: 21
                    }}
                  >
                    Adjust the fit
                  </h3>

                  <select
                    aria-label="Choose clothing piece to adjust"
                    value={
                      activeId &&
                      picked.includes(activeId)
                        ? activeId
                        : selectedItems[0]._id
                    }
                    onChange={(e) =>
                      setActiveId(
                        e.target.value
                      )
                    }
                  >
                    {selectedItems.map(
                      (item) => (
                        <option
                          key={item._id}
                          value={item._id}
                        >
                          {item.name}
                        </option>
                      )
                    )}
                  </select>

                  {(() => {
                    const item =
                      selectedItems.find(
                        (x) =>
                          x._id === activeId
                      ) || selectedItems[0];

                    const p = positionOf(item);

                    const slider = (
                      name,
                      field,
                      min,
                      max
                    ) => (
                      <label key={field}>
                        <span>{name}</span>

                        <input
                          type="range"
                          min={min}
                          max={max}
                          value={p[field]}
                          onChange={(e) => {
                            setActiveId(
                              item._id
                            );

                            setPlacements(
                              (old) => ({
                                ...old,
                                [item._id]: {
                                  ...p,
                                  [field]:
                                    Number(
                                      e.target.value
                                    )
                                }
                              })
                            );
                          }}
                        />

                        <span>
                          {Math.round(
                            p[field]
                          )}%
                        </span>
                      </label>
                    );

                    return (
                      <>
                        {slider(
                          "Left / right",
                          "x",
                          0,
                          90
                        )}

                        {slider(
                          "Up / down",
                          "y",
                          0,
                          90
                        )}

                        {slider(
                          "Width",
                          "w",
                          8,
                          100
                        )}

                        {slider(
                          "Height",
                          "h",
                          8,
                          90
                        )}

                        <div className="s360-row">
                          <button
                            type="button"
                            className="s360-outline"
                            onClick={() => {
                              setPlacements(
                                (old) => ({
                                  ...old,
                                  [item._id]:
                                    placementFor(
                                      item.category
                                    )
                                })
                              );
                            }}
                          >
                            Reset this piece
                          </button>

                          <button
                            type="button"
                            className="s360-outline"
                            onClick={() =>
                              setPicked(
                                (old) =>
                                  old.filter(
                                    (id) =>
                                      id !==
                                      item._id
                                  )
                              )
                            }
                          >
                            Remove piece
                          </button>

                          <button
                            type="button"
                            className="s360-primary"
                            onClick={exportLook}
                            disabled={
                              !photos.front ||
                              saving
                            }
                          >
                            {saving
                              ? "Saving…"
                              : "↓ Save styled photo"}
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              <p
                style={{
                  fontSize: 12
                }}
              >
                This is an adjustable 2D styling
                overlay, not AI garment fitting.
                For the cleanest preview, use
                product photos on plain, light
                backgrounds or transparent PNGs.
              </p>
            </div>
          )}

          {/* SAVE & SHARE */}
          {tab === "save" && (
            <div className="s360-lower">
              <h3>Save &amp; Share</h3>

              <p>
                Export the current model view{" "}
                {view === "front"
                  ? "with your selected clothing overlays"
                  : "as a photograph"}.
                Your selected clothes and their
                positions are saved in this browser.
              </p>

              <button
                type="button"
                className="s360-primary"
                disabled={
                  !activePhoto || saving
                }
                onClick={exportLook}
              >
                {saving
                  ? "Preparing PNG…"
                  : "↓ Export Style Studio PNG"}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <aside
          className="s360-angle-box"
          aria-label="Photo angles"
        >
          <h3>View angles</h3>

          {ANGLES.map((angle) => (
            <button
              type="button"
              key={angle.id}
              className={`s360-angle ${
                view === angle.id
                  ? "active"
                  : ""
              }`}
              disabled={
                !photos[angle.id]
              }
              onClick={() => {
                setView(angle.id);
                setZoom(1);
              }}
            >
              {photos[angle.id] ? (
                <img
                  alt={angle.name}
                  src={
                    photos[angle.id].url
                  }
                />
              ) : (
                <span className="s360-angle-empty">
                  + {angle.name}
                </span>
              )}

              <span className="s360-angle-label">
                {angle.name} ·{" "}
                {angle.degree}
              </span>
            </button>
          ))}
        </aside>
      </div>

      {error && (
        <div
          className="s360-alert"
          role="alert"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          className="s360-alert s360-success"
          role="status"
        >
          {message}
        </div>
      )}

      <p className="s360-note">
        Style Studio keeps uploaded model
        photos on this device and displays
        wardrobe items as draggable 2D
        layers. It does not produce 3D
        reconstruction or physically
        simulate fabric.
      </p>
    </main>
  );
}
