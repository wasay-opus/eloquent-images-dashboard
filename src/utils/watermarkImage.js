export const GALLERY_WATERMARK_ENABLED = true;

const WATERMARK_TEXT = "Eloquent Image by Adrian";
const WATERMARK_FONT_FAMILY = '"Vivaldi Std", Vivaldi, "Edwardian Script ITC", cursive';
const WATERMARK_MIN_FONT_SIZE = 30;
const WATERMARK_MAX_FONT_SIZE = 260;
const WATERMARK_FONT_RATIO = 0.072;
const WATERMARK_LANDSCAPE_FONT_RATIO = 0.048;
const WATERMARK_TEXT_WIDTH_RATIO = 0.78;
const WATERMARK_OUTPUT_TYPE = "image/jpeg";
const WATERMARK_OUTPUT_QUALITY = 0.86;
const WATERMARK_MAX_DIMENSION = 3200;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

async function loadWatermarkFont(fontSize) {
  if (!document.fonts?.load) return;

  try {
    await document.fonts.load(`${fontSize}px ${WATERMARK_FONT_FAMILY}`, WATERMARK_TEXT);
  } catch {
    // Browser will fall back to the next available script font.
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read ${file.name}`));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, type, quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not apply watermark to the image."));
      },
      type,
      quality
    );
  });
}

function getWatermarkedFileName(fileName = "image.jpg") {
  return fileName.replace(/\.[^.]+$/, "") + ".jpg";
}

export async function addGalleryWatermark(file) {
  if (!GALLERY_WATERMARK_ENABLED || !file?.type?.startsWith("image/")) return file;

  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.min(1, WATERMARK_MAX_DIMENSION / Math.max(sourceWidth, sourceHeight));

  canvas.width = Math.round(sourceWidth * scale);
  canvas.height = Math.round(sourceHeight * scale);

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const shortSide = Math.min(canvas.width, canvas.height);
  const isLandscape = canvas.width > canvas.height * 1.08;
  const baseFontSize = clamp(
    Math.round(shortSide * (isLandscape ? WATERMARK_LANDSCAPE_FONT_RATIO : WATERMARK_FONT_RATIO)),
    WATERMARK_MIN_FONT_SIZE,
    WATERMARK_MAX_FONT_SIZE
  );
  const maxTextWidth = canvas.width * WATERMARK_TEXT_WIDTH_RATIO;
  let fontSize = baseFontSize;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  await loadWatermarkFont(fontSize);

  do {
    ctx.font = `500 ${fontSize}px ${WATERMARK_FONT_FAMILY}`;
    fontSize -= 2;
  } while (
    ctx.measureText(WATERMARK_TEXT).width > maxTextWidth &&
    fontSize > WATERMARK_MIN_FONT_SIZE
  );

  fontSize += 2;
  ctx.font = `500 ${fontSize}px ${WATERMARK_FONT_FAMILY}`;

  const x = canvas.width / 2;
  const bottomMargin = isLandscape
    ? clamp(Math.round(shortSide * 0.04), 18, 48)
    : clamp(Math.round(shortSide * 0.055), 22, 64);
  const y = canvas.height - bottomMargin - fontSize * 0.2;

  ctx.save();
  // ctx.shadowColor = "rgba(0, 0, 0, 0.24)";
  ctx.shadowBlur = 1;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.14)";
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.strokeText(WATERMARK_TEXT, x, y, maxTextWidth);
  ctx.fillText(WATERMARK_TEXT, x, y, maxTextWidth);
  ctx.restore();

  const blob = await canvasToBlob(canvas, WATERMARK_OUTPUT_TYPE, WATERMARK_OUTPUT_QUALITY);

  return new File([blob], getWatermarkedFileName(file.name), {
    type: WATERMARK_OUTPUT_TYPE,
    lastModified: Date.now(),
  });
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

// Watermarks a list of files with the exact gallery watermark.
// Videos and other non-image files are passed through untouched.
export async function addWatermarkToFiles(files = [], concurrency = 3) {
  if (!GALLERY_WATERMARK_ENABLED || files.length === 0) return files;
  return mapWithConcurrency(files, concurrency, addGalleryWatermark);
}
