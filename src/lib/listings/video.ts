/**
 * Listing videos, in the browser: limits, the location scrub and the poster frame.
 *
 * Phones write where a video was filmed into the file, as an ISO 6709 string
 * such as "+23.8103+090.4125+012.000/" (iPhone: com.apple.quicktime.location;
 * Android: the ©xyz tag). Those tags live in the file's "moov" box. Before
 * upload, every such string in moov has its digits replaced with zeros, so it
 * reads "+00.0000+000.0000+000.000/". The length stays the same, so the file
 * still plays. The site keeps a property's exact location private, so this
 * matters as much for videos as for photos.
 */

export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
/** The bucket and Supabase's free plan both stop at 50 MB. */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 120;

const isDigit = (byte: number | undefined) => byte !== undefined && byte >= 0x30 && byte <= 0x39;
const isSign = (byte: number | undefined) => byte === 0x2b || byte === 0x2d;

/** Counts digits from `at`; returns the index after them. */
function digitsFrom(bytes: Uint8Array, at: number, end: number): number {
  let index = at;
  while (index < end && isDigit(bytes[index])) index += 1;
  return index;
}

/**
 * Zeroes every ISO 6709 coordinate ("±DD.D±DDD.D", optional altitude) between
 * start and end. Changes bytes in place and returns how many it found.
 */
export function scrubIso6709(bytes: Uint8Array, start = 0, end = bytes.length): number {
  let found = 0;
  for (let index = start; index < end - 8; index += 1) {
    if (!isSign(bytes[index])) continue;
    // Latitude: two digits, a dot, at least one digit.
    let cursor = index + 1;
    let next = digitsFrom(bytes, cursor, end);
    if (next - cursor !== 2 || bytes[next] !== 0x2e) continue;
    cursor = next + 1;
    next = digitsFrom(bytes, cursor, end);
    if (next === cursor || !isSign(bytes[next])) continue;
    // Longitude: three digits, a dot, at least one digit.
    cursor = next + 1;
    next = digitsFrom(bytes, cursor, end);
    if (next - cursor !== 3 || bytes[next] !== 0x2e) continue;
    cursor = next + 1;
    next = digitsFrom(bytes, cursor, end);
    if (next === cursor) continue;
    // Optional altitude: sign, digits, optional fraction.
    if (isSign(bytes[next])) {
      const after = digitsFrom(bytes, next + 1, end);
      if (after > next + 1) {
        next = after;
        if (bytes[next] === 0x2e) next = digitsFrom(bytes, next + 1, end);
      }
    }
    for (let k = index; k < next; k += 1) if (isDigit(bytes[k])) bytes[k] = 0x30;
    found += 1;
    index = next;
  }
  return found;
}

/** Walks the top-level boxes of an MP4/MOV file and scrubs inside every "moov" box. */
export function scrubVideoLocation(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  let found = 0;
  while (offset + 8 <= bytes.length) {
    let size = view.getUint32(offset);
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > bytes.length) break;
      size = Number(view.getBigUint64(offset + 8));
      header = 16;
    } else if (size === 0) {
      size = bytes.length - offset;
    }
    if (size < header) break;
    const end = Math.min(bytes.length, offset + size);
    if (type === "moov") found += scrubIso6709(bytes, offset + header, end);
    offset += size;
  }
  return found;
}

/** A copy of the file with its location tags blanked. WebM has none; it goes through unchanged. */
export async function withoutLocation(file: File): Promise<Blob> {
  if (file.type === "video/webm") return file;
  const bytes = new Uint8Array(await file.arrayBuffer());
  scrubVideoLocation(bytes);
  return new Blob([bytes], { type: file.type });
}

/** Loads a video file into a hidden element. Rejects if this browser cannot open it. */
function load(url: string, timeoutMs: number): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const timer = window.setTimeout(() => reject(new Error("timeout")), timeoutMs);
    video.onloadeddata = () => {
      window.clearTimeout(timer);
      resolve(video);
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("unreadable"));
    };
    video.src = url;
  });
}

/** How long the video is, in seconds, or null if this browser cannot open it. */
export async function videoDuration(url: string): Promise<number | null> {
  try {
    const video = await load(url, 15000);
    return Number.isFinite(video.duration) ? video.duration : null;
  } catch {
    return null;
  }
}

/** A still from about one second in, as WebP (or JPEG), to show before the video plays. Null if it fails. */
export async function posterFrame(url: string): Promise<Blob | null> {
  try {
    const video = await load(url, 15000);
    video.currentTime = Math.min(1, (video.duration || 2) / 2);
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      window.setTimeout(resolve, 3000);
    });
    const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight, 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const webp = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.8));
    if (webp && webp.type === "image/webp") return webp;
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
  } catch {
    return null;
  }
}
