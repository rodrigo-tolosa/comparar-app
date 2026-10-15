"use client";
import JSZip from "jszip";

/** Empaqueta una lista de archivos { name, blob } en un único .zip y lo descarga. */
export async function downloadZip(files: { name: string; blob: Blob }[], zipName: string) {
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.blob);
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = zipName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
