'use client';

import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  type LucideIcon,
  Quote,
  RemoveFormatting,
  Underline,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

type Cmd = {
  key:
    | 'bold'
    | 'italic'
    | 'underline'
    | 'h2'
    | 'h3'
    | 'bulletList'
    | 'orderedList'
    | 'quote'
    | 'code'
    | 'link'
    | 'clear';
  icon: LucideIcon;
  run: () => void;
};

/**
 * Minimal rich-text editor (contentEditable + document.execCommand) — no editor dependency.
 * Produces HTML; the API must sanitise it before storing/serving (backend-content).
 */
export function RichTextEditor({
  value,
  onChange,
  label,
  invalid,
  className,
}: {
  value: string;
  onChange: (html: string) => void;
  label: string;
  invalid?: boolean;
  className?: string;
}) {
  const t = useTranslations('admin.richText');
  const ref = useRef<HTMLDivElement>(null);

  // Only push external value into the DOM when it differs (keeps the caret while typing).
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value) el.innerHTML = value;
  }, [value]);

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const cmds: Cmd[] = [
    { key: 'bold', icon: Bold, run: () => exec('bold') },
    { key: 'italic', icon: Italic, run: () => exec('italic') },
    { key: 'underline', icon: Underline, run: () => exec('underline') },
    { key: 'h2', icon: Heading2, run: () => exec('formatBlock', 'h2') },
    { key: 'h3', icon: Heading3, run: () => exec('formatBlock', 'h3') },
    { key: 'bulletList', icon: List, run: () => exec('insertUnorderedList') },
    { key: 'orderedList', icon: ListOrdered, run: () => exec('insertOrderedList') },
    { key: 'quote', icon: Quote, run: () => exec('formatBlock', 'blockquote') },
    { key: 'code', icon: Code, run: () => exec('formatBlock', 'pre') },
    {
      key: 'link',
      icon: Link2,
      run: () => {
        const url = window.prompt(t('linkPrompt'), 'https://');
        if (url && /^https?:\/\//i.test(url)) exec('createLink', url);
      },
    },
    { key: 'clear', icon: RemoveFormatting, run: () => exec('removeFormat') },
  ];

  return (
    <div
      className={cn(
        'border-input focus-within:border-ring focus-within:ring-ring/50 rounded-md border focus-within:ring-[3px]',
        invalid && 'border-destructive',
        className,
      )}
    >
      <div role="toolbar" aria-label={t('toolbar')} className="flex flex-wrap gap-0.5 border-b p-1">
        {cmds.map(({ key, icon: Icon, run }) => (
          <button
            key={key}
            type="button"
            title={t(key)}
            aria-label={t(key)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={run}
            className="hover:bg-accent focus-visible:ring-ring/50 rounded p-1.5 outline-none focus-visible:ring-[3px]"
          >
            <Icon className="size-4" aria-hidden />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        aria-invalid={invalid || undefined}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        className="prose-sm [&_pre]:bg-muted [&_a]:text-primary min-h-40 max-w-none px-3 py-2 text-sm outline-none [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:pl-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:rounded [&_pre]:p-2 [&_ul]:list-disc [&_ul]:pl-5"
      />
    </div>
  );
}
