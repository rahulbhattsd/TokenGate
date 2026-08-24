import { get_encoding } from 'tiktoken';
export const countTokens = (text: string, model: string): { count: number; exact: boolean } => {
  const enc = get_encoding('cl100k_base');
  const count = enc.encode(text).length;
  enc.free();
  return { count, exact: model.startsWith('gpt-') };
};
