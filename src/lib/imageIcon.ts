/** Center-crops and shrinks a picture to a 256×256 JPEG in the browser, so uploads stay tiny. */
export async function toIcon(file: File): Promise<string> {
  return crop(file, 256, 256, 0.85);
}

/** Center-crops a picture to a wide 3:1 banner (1200×400 JPEG). */
export async function toBanner(file: File): Promise<string> {
  return crop(file, 1200, 400, 0.8);
}

async function crop(file: File, width: number, height: number, quality: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const target = width / height;
  // Largest centered area with the target shape.
  let sw = bitmap.width;
  let sh = bitmap.width / target;
  if (sh > bitmap.height) {
    sh = bitmap.height;
    sw = bitmap.height * target;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}
