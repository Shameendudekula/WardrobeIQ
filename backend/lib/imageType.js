// Detect an image's real type from its leading bytes ("magic numbers").
// Returns a MIME type for supported formats, or null for anything else.
export function sniffImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  const gif = buf.toString("ascii", 0, 6);
  if (gif === "GIF87a" || gif === "GIF89a") return "image/gif";
  return null;
}
