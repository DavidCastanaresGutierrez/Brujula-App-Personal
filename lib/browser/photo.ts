export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const ACCEPTED_TYPES = /^image\/(jpeg|png|webp)$/;

// Phone cameras produce 3–12 MB photos. The model only needs a small image, so the
// photo is scaled down in the browser: faster uploads, fewer tokens on free tiers and
// no size rejections. Falls back to the original file when the browser cannot decode it.
export async function prepareFoodPhoto(file: File, maxEdge = 1280, quality = 0.82): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    if (ACCEPTED_TYPES.test(file.type) && file.size <= MAX_PHOTO_BYTES) return file;
    throw new Error("No se ha podido leer la foto. Usa una imagen JPG, PNG o WEBP de menos de 4 MB.");
  }
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height, 1));
    if (scale === 1 && file.type === "image/jpeg" && file.size <= MAX_PHOTO_BYTES) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se ha podido preparar la foto en este navegador.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("No se ha podido preparar la foto en este navegador.");
    if (blob.size > MAX_PHOTO_BYTES) throw new Error("La foto sigue siendo demasiado grande tras reducirla.");
    return new File([blob], "comida.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

export function suggestedMealType(date = new Date()) {
  const hour = date.getHours();
  if (hour < 11) return "breakfast" as const;
  if (hour < 13) return "mid_morning" as const;
  if (hour < 16) return "lunch" as const;
  if (hour < 20) return "snack" as const;
  return "dinner" as const;
}
