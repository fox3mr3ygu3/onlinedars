'use client';

import DOMPurify from 'dompurify';
import { useEffect, useState } from 'react';
import { richTextToHtml } from './content';

/**
 * Renders lesson rich text (HTML or markdown) after client-side sanitising (defence in depth).
 * DOMPurify needs the DOM, so the HTML is set after mount: server and first client render are both
 * empty (no hydration mismatch on server-rendered pages such as the public lesson preview).
 */
export function RichText({ content }: { content: string }) {
  const [html, setHtml] = useState('');
  useEffect(() => {
    setHtml(
      DOMPurify.sanitize(richTextToHtml(content), {
        USE_PROFILES: { html: true },
        ADD_ATTR: ['target'],
        FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe'],
      }),
    );
  }, [content]);
  return (
    <div
      className="lesson-prose [&_a]:text-primary [&_code]:bg-secondary [&_pre]:bg-secondary max-w-none leading-7 [&_a]:underline [&_code]:rounded [&_code]:px-1 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:mt-4 [&_h4]:font-semibold [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-lg [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-6"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
