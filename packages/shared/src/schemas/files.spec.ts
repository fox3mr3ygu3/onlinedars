import { describe, expect, it } from 'vitest';
import { uploadFieldsSchema } from './files';

describe('uploadFieldsSchema', () => {
  it('treats a missing multipart body as empty fields (purpose defaults to FILE)', () => {
    expect(uploadFieldsSchema.parse(undefined)).toEqual({ purpose: 'FILE' });
    expect(uploadFieldsSchema.parse(null)).toEqual({ purpose: 'FILE' });
  });

  it('keeps an explicit purpose and rejects unknown ones', () => {
    expect(uploadFieldsSchema.parse({ purpose: 'IMAGE' })).toEqual({ purpose: 'IMAGE' });
    expect(uploadFieldsSchema.safeParse({ purpose: 'VIDEO' }).success).toBe(false);
  });
});
