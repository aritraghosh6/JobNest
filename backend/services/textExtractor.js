const path = require("path");
const mammoth = require("mammoth");
const pdfLib = require("pdf-parse");

/**
 * Reads the text of a PDF. Works with both pdf-parse versions, because laptops in the
 * team may have either installed:
 *   - version 2.x exports a class:   new PDFParse({ data }).getText()
 *   - version 1.x exports a function: pdfParse(buffer) -> { text }
 */
async function readPdfText(buffer) {
  if (pdfLib && typeof pdfLib.PDFParse === "function") {
    const parser = new pdfLib.PDFParse({ data: buffer });
    try {
      const data = await parser.getText();
      return data.text || "";
    } finally {
      if (typeof parser.destroy === "function") await parser.destroy();
    }
  }
  const parse = typeof pdfLib === "function" ? pdfLib : pdfLib && pdfLib.default;
  if (typeof parse !== "function") throw new Error("pdf-parse is not installed correctly");
  const data = await parse(buffer);
  return data.text || "";
}
const AppError = require("../utils/AppError");
const { hasValidSignature } = require("../utils/files");
const MIN_WORDS = 50;
/**
 * Extracts plain text from an uploaded PDF or DOCX held in memory.
 * Throws a clear AppError for unsupported, corrupted, scanned or empty files.
 * The file is only read, never executed or saved.
 */
async function extractText(file) {
  if (!file || !file.buffer)
    throw new AppError(400, "Please upload your resume as a PDF or DOCX file.");
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (!hasValidSignature(file.buffer, file.originalname)) {
    throw new AppError(
      400,
      "This file does not look like a valid PDF or DOCX document."
    );
  }
  let text = "";
  try {
    if (ext === ".pdf") {
      text = await readPdfText(file.buffer);
    } else if (ext === ".docx") {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      text = result.value || "";
    } else {
      throw new AppError(
        400,
        "Unsupported file type. Please upload a PDF or DOCX file."
      );
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    // Shows the real reason in the backend terminal (the user only sees the friendly message)
    console.error(`Could not read ${file.originalname}:`, err.message);
    throw new AppError(
      422,
      "We could not read this document. It may be damaged or password-protected."
    );
  }
  text = text
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const wordCount = text ? text.split(/\s+/).length : 0;
  if (wordCount < MIN_WORDS) {
    throw new AppError(
      422,
      `We could only read ${wordCount} words from this resume. If it is a scanned image or uses unusual ` +
        "formatting, export it again as a text-based PDF or DOCX and try once more."
    );
  }
  return { text, wordCount, fileType: ext.slice(1) };
}
module.exports = { extractText, MIN_WORDS };
