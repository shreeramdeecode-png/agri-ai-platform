import multer from "multer";
import path from "path";
import fs from "fs/promises";

// @ts-ignore — use the Node.js-compatible legacy build (standard build requires DOMMatrix/browser APIs)
import * as _pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
const pdfjsLib = _pdfjsLib as any;
pdfjsLib.GlobalWorkerOptions.workerSrc = "";

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads");
    try {
      await fs.mkdir(uploadDir, { recursive: true });
    } catch (error) {
      console.error("Error creating upload directory:", error);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  }
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, JPEG, JPG, and PNG files are allowed"));
    }
  }
});

export async function extractPdfText(filePath: string): Promise<string> {
  try {
    console.log("[PDF] Reading file:", filePath);
    const dataBuffer = await fs.readFile(filePath);
    const uint8Array = new Uint8Array(dataBuffer);
    console.log("[PDF] File read OK, bytes:", uint8Array.length);

    const doc = await pdfjsLib.getDocument({
      data: uint8Array,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;

    console.log("[PDF] Loaded document, pages:", doc.numPages);

    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = (content.items as any[])
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      pages.push(pageText);
    }

    const result = pages.join("\n").trim();
    console.log("[PDF] Extracted text length:", result.length, "chars");
    return result;
  } catch (error: any) {
    console.error("[PDF] Extraction failed:", error.message);
    return "";
  }
}

export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error("Error deleting file:", error);
  }
}
