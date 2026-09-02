import path from 'path';
import pdfParse from 'pdf-parse';
import { TextPart } from './chunking';

export interface ExtractedDocumentText {
  parts: TextPart[];
  text: string;
  normalizedName: string;
  extension: string;
}

const allowedExtensions = new Set(['.txt', '.md', '.json', '.csv', '.pdf']);
const allowedMimeTypes: Record<string, string[]> = {
  '.txt': ['text/plain', 'application/octet-stream'],
  '.md': ['text/markdown', 'text/plain', 'application/octet-stream'],
  '.json': ['application/json', 'text/plain', 'application/octet-stream'],
  '.csv': ['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/octet-stream'],
  '.pdf': ['application/pdf', 'application/octet-stream'],
};

const hasBinaryNulls = (buffer: Buffer) => buffer.subarray(0, Math.min(buffer.length, 4096)).includes(0);

export const sanitizeFileName = (name: string) => {
  const base = path.basename(name).replace(/[^\w.\- ()]/g, '_').trim();
  return base || 'document';
};

export const validateUpload = (file: Express.Multer.File) => {
  const maxBytes = parseInt(process.env.RAG_MAX_FILE_BYTES || `${10 * 1024 * 1024}`);
  const normalizedName = sanitizeFileName(file.originalname || 'document');
  const extension = path.extname(normalizedName).toLowerCase();

  if (!allowedExtensions.has(extension)) {
    throw new Error('Unsupported file extension');
  }
  if (file.size <= 0) {
    throw new Error('Uploaded file is empty');
  }
  if (file.size > maxBytes) {
    throw new Error(`Uploaded file exceeds ${maxBytes} bytes`);
  }

  const acceptedMimes = allowedMimeTypes[extension] || [];
  if (file.mimetype && !acceptedMimes.includes(file.mimetype)) {
    throw new Error('Unsupported MIME type for file extension');
  }
  if (extension === '.pdf') {
    const header = file.buffer.subarray(0, 4).toString('utf8');
    if (header !== '%PDF') throw new Error('Invalid PDF file signature');
  } else if (hasBinaryNulls(file.buffer)) {
    throw new Error('Text document appears to contain binary data');
  }

  return { normalizedName, extension };
};

const normalizeText = (text: string) =>
  text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/[ \t]+\n/g, '\n').trim();

const extractTextFile = (buffer: Buffer, extension: string): TextPart[] => {
  const raw = buffer.toString('utf8');

  if (extension === '.json') {
    const parsed = JSON.parse(raw);
    return [{ text: normalizeText(JSON.stringify(parsed, null, 2)) }];
  }

  return [{ text: normalizeText(raw) }];
};

const extractPdf = async (buffer: Buffer): Promise<TextPart[]> => {
  const pageTexts: TextPart[] = [];
  const options = {
    pagerender: async (pageData: any) => {
      const content = await pageData.getTextContent();
      const text = content.items.map((item: any) => item.str).join(' ');
      const page = pageTexts.length + 1;
      pageTexts.push({ text: normalizeText(text), metadata: { page } });
      return text;
    },
  };

  const result = await pdfParse(buffer, options);
  if (pageTexts.length > 0) {
    return pageTexts.filter(part => part.text.trim().length > 0);
  }

  return [{ text: normalizeText(result.text) }];
};

export const extractDocumentText = async (file: Express.Multer.File): Promise<ExtractedDocumentText> => {
  const { normalizedName, extension } = validateUpload(file);
  const parts = extension === '.pdf'
    ? await extractPdf(file.buffer)
    : extractTextFile(file.buffer, extension);

  const filteredParts = parts
    .map(part => ({ ...part, text: normalizeText(part.text) }))
    .filter(part => part.text.length > 0);

  if (filteredParts.length === 0) {
    throw new Error('No extractable text found in document');
  }

  return {
    parts: filteredParts,
    text: filteredParts.map(part => part.text).join('\n\n'),
    normalizedName,
    extension,
  };
};
