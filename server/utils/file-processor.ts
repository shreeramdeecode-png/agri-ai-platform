import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

const multerStorage = multer.diskStorage({
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
  storage: multerStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
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

/**
 * Extract text from a PDF using Gemini's native PDF understanding.
 * This replaces pdfjs-dist / pdf-parse which both have Node.js compatibility issues.
 */
export async function extractPdfText(filePath: string): Promise<string> {
  try {
    console.log("[PDF] Reading file:", filePath);
    const dataBuffer = await fs.readFile(filePath);
    const base64Data = dataBuffer.toString("base64");
    console.log("[PDF] File size:", dataBuffer.length, "bytes");

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: base64Data,
        },
      },
      `Extract ALL text content from this PDF document exactly as written.
Return only the raw text — no commentary, no markdown formatting, no paraphrasing.
Preserve headings, numbers, tables, and lists as closely as possible.`,
    ]);

    const text = result.response.text().trim();
    console.log("[PDF] Extracted text length:", text.length, "chars");
    return text;
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
