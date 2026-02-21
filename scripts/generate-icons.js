// Generate minimal PNG icons for PWA
// These are valid PNGs - replace with designed icons later
// Run: node scripts/generate-icons.js

const fs = require("fs");
const path = require("path");

// Create a simple PNG with zlib
const zlib = require("zlib");

function createPNG(width, height, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type (RGB)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw image data: filter byte + RGB for each pixel, for each row
  const rawData = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 3);
    rawData[rowOffset] = 0; // no filter
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      // Create a simple gradient/shape for the "T" letter look
      const cx = width / 2;
      const cy = height / 2;
      const margin = width * 0.15;
      const isBackground = true;

      // Top bar of T
      const isTopBar =
        y >= height * 0.25 &&
        y <= height * 0.38 &&
        x >= margin &&
        x <= width - margin;
      // Stem of T
      const isStem =
        y >= height * 0.38 &&
        y <= height * 0.75 &&
        x >= cx - width * 0.08 &&
        x <= cx + width * 0.08;

      if (isTopBar || isStem) {
        // White letter
        rawData[pixelOffset] = 255;
        rawData[pixelOffset + 1] = 255;
        rawData[pixelOffset + 2] = 255;
      } else if (isBackground) {
        // Violet gradient background
        const dist = Math.sqrt(
          Math.pow((x - cx) / width, 2) + Math.pow((y - cy) / height, 2)
        );
        const factor = Math.min(1, dist * 1.5);
        rawData[pixelOffset] = Math.round(r * (1 - factor * 0.3));
        rawData[pixelOffset + 1] = Math.round(g * (1 - factor * 0.3));
        rawData[pixelOffset + 2] = Math.round(b * (1 - factor * 0.3));
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);

  function createChunk(type, data) {
    const typeBuffer = Buffer.from(type, "ascii");
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const crcData = Buffer.concat([typeBuffer, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcData), 0);
    return Buffer.concat([length, typeBuffer, data, crc]);
  }

  // CRC32 implementation
  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  const ihdrChunk = createChunk("IHDR", ihdr);
  const idatChunk = createChunk("IDAT", compressed);
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(iconsDir, { recursive: true });

// Violet color: #7c3aed -> rgb(124, 58, 237)
const sizes = [
  [192, "icon-192.png"],
  [512, "icon-512.png"],
  [180, "apple-touch-icon.png"],
];

for (const [size, name] of sizes) {
  const png = createPNG(size, size, 124, 58, 237);
  const filePath = path.join(iconsDir, name);
  fs.writeFileSync(filePath, png);
  console.log(`Generated: ${filePath} (${size}x${size}, ${png.length} bytes)`);
}

console.log("Done! Replace these with designed icons for production.");
