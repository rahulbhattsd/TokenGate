import { get_encoding } from 'tiktoken';

const enc = get_encoding('cl100k_base');

export const countTokens = (text: string, model: string): { count: number; exact: boolean } => {
  const count = enc.encode(text).length;
  return { count, exact: model.startsWith('gpt-') };
};
