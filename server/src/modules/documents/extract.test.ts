import { describe, expect, it } from 'vitest';
import { extractDocumentText, sanitizeFileName, validateUpload } from './extract';

const file = (name: string, mimetype: string, content: string | Buffer): Express.Multer.File => {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  return {
    fieldname: 'file',
    originalname: name,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: undefined as any,
  };
};

describe('extractDocumentText', () => {
  it.each([
    ['verification.txt', 'text/plain', 'plain text'],
    ['verification.md', 'text/markdown', '# Title\n\nmarkdown text'],
    ['verification.csv', 'text/csv', 'name,value\nleave,27'],
    ['verification.json', 'application/json', '{"leaveDays":27}'],
  ])('extracts supported text format %s', async (name, mimetype, content) => {
    const result = await extractDocumentText(file(name, mimetype, content));

    expect(result.normalizedName).toBe(name);
    expect(result.text).toContain(name.endsWith('.json') ? 'leaveDays' : content.split('\n')[0]);
    expect(result.parts.length).toBeGreaterThan(0);
  });

  it('rejects path traversal names and unsupported extensions', () => {
    expect(sanitizeFileName('../secret.txt')).toBe('secret.txt');
    expect(() => validateUpload(file('script.exe', 'application/octet-stream', 'nope'))).toThrow('Unsupported file extension');
  });

  it('rejects binary content for text uploads', () => {
    expect(() => validateUpload(file('binary.txt', 'text/plain', Buffer.from([0, 1, 2, 3])))).toThrow('binary data');
  });

  it('rejects invalid PDF signatures', () => {
    expect(() => validateUpload(file('fake.pdf', 'application/pdf', 'not a pdf'))).toThrow('Invalid PDF file signature');
  });
});
