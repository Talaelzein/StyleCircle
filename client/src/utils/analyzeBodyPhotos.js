// StyleCircle Photo-Guided Avatar — client-side pose and silhouette analysis.
// The estimates here are relative visual proportions, NOT medical/body measurements
// and NOT a photorealistic 3D body reconstruction.
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

const MP_VERSION = "1.2.3";
const WASM_URL = "/mediapipe";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
let detectorPromise;

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

async function getDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const wasm = await FilesetResolver.forVisionTasks(WASM_URL);
      return PoseLandmarker.createFromOptions(wasm, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        runningMode: "IMAGE",
        numPoses: 1,
        outputSegmentationMasks: false,
      });
    })().catch((error) => { detectorPromise = null; throw error; });
  }
  return detectorPromise;
}

async function imageFromUrl(url) {
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await image.decode();
  // Large mobile images are scaled down for local inference only.
  const scale = Math.min(1, 1000 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function rowWidth(maskData, maskWidth, maskHeight, centerX, yNorm, halfRange) {
  if (!maskData) return null;
  const y = clamp(Math.round(yNorm * maskHeight), 0, maskHeight - 1);
  const c = clamp(Math.round(centerX * maskWidth), 0, maskWidth - 1);
  const maxR = Math.max(3, Math.floor(halfRange * maskWidth));
  // Read the connected foreground area through the estimated torso centre.
  const occupied = (x) => maskData[y * maskWidth + x] > 0.5;
  let seed = c;
  if (!occupied(seed)) {
    let found = false;
    for (let d = 1; d < maxR; d++) {
      if (c - d >= 0 && occupied(c - d)) { seed = c - d; found = true; break; }
      if (c + d < maskWidth && occupied(c + d)) { seed = c + d; found = true; break; }
    }
    if (!found) return null;
  }
  let left = seed, right = seed;
  while (left > Math.max(0, c - maxR) && occupied(left - 1)) left--;
  while (right < Math.min(maskWidth - 1, c + maxR) && occupied(right + 1)) right++;
  return (right - left + 1) / maskWidth;
}

function requirePose(landmarks, which) {
  if (!landmarks?.length) {
    throw new Error(`I couldn't locate one standing person in the ${which} photo. Try a clear full-body photo with arms slightly away from the torso.`);
  }
  for (const id of [11, 12, 23, 24]) {
    if (!landmarks[id] || (landmarks[id].visibility ?? 1) < 0.35) {
      throw new Error(`The ${which} photo doesn't clearly show both shoulders and hips. Try a front-on, full-body picture.`);
    }
  }
}

async function scanOne(detector, url, which) {
  const canvas = await imageFromUrl(url);
  let output;
  try {
    output = detector.detect(canvas);
    const landmarks = output.landmarks?.[0];
    requirePose(landmarks, which);
    const leftShoulder = landmarks[11], rightShoulder = landmarks[12];
    const leftHip = landmarks[23], rightHip = landmarks[24];
    const sh = distance(leftShoulder, rightShoulder);
    if (sh < 0.04) throw new Error(`The ${which} image is too far away or angled to estimate proportions.`);
    const centerX = (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4;
    const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const hipY = (leftHip.y + rightHip.y) / 2;
    const torso = hipY - shoulderY;
    if (torso < 0.06) throw new Error(`The ${which} picture needs an upright, visible torso.`);
    const mask = output.segmentationMasks?.[0];
    const maskData = mask ? mask.getAsFloat32Array() : null;
    const read = (t) => rowWidth(maskData, mask?.width || 1, mask?.height || 1, centerX, shoulderY + torso * t, sh * 0.77);
    const bustWidth = read(0.28) || sh * 0.94;
    const waistWidth = read(0.69) || sh * 0.78;
    const hipWidth = read(1.00) || distance(leftHip, rightHip);
    // These ratios simply drive avatar sliders; they are not cm or fitted sizes.
    return { bustWidth, waistWidth, hipWidth, shoulderWidth: sh,
      hipLandmarkWidth: distance(leftHip, rightHip),
      canSeeFeet: (landmarks[27]?.visibility ?? 0) > 0.45 && (landmarks[28]?.visibility ?? 0) > 0.45 };
  } finally {
    output?.close?.();
  }
}

export async function analyzeBodyPhotos(frontUrl, backUrl) {
  if (!frontUrl || !backUrl) throw new Error("Add both a front and a back photograph first.");
  const detector = await getDetector();
  const front = await scanOne(detector, frontUrl, "front");
  const back = await scanOne(detector, backUrl, "back");
  const avg = (field) => (front[field] + back[field]) / 2;
  const shoulder = avg("shoulderWidth");
  const profile = {
    bust: clamp((avg("bustWidth") / shoulder) / 0.96, 0.85, 1.2),
    waist: clamp((avg("waistWidth") / shoulder) / 0.80, 0.78, 1.22),
    hips: clamp((avg("hipWidth") / shoulder) / 1.04, 0.85, 1.2),
    height: 1, // Height cannot be accurately recovered from photo scale.
    status: "Photo-guided approximation",
    timestamp: Date.now(),
    note: (!front.canSeeFeet || !back.canSeeFeet)
      ? "For more complete pose detection, use full-length photos that show your feet."
      : "Both full-body poses were detected.",
  };
  return profile;
}
