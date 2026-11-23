'use client';

import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type KeyboardEvent, type ReactNode, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { moveItem } from './reorder';

/**
 * Reorderable list: mouse drag-and-drop (native HTML5 DnD) plus keyboard — focus the grip and press
 * ↑/↓ (or Alt+↑/↓ anywhere in the row), or use the up/down buttons. `onReorder` gets the new array;
 * the caller persists it (`PATCH …/reorder {ids}`).
 */
export function SortableList<T extends { id: string }>({
  items,
  label,
  renderItem,
  onReorder,
  disabled,
  className,
}: {
  items: T[];
  label: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  onReorder: (next: T[], moved: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations('admin.common');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const handles = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, to: number) => {
    if (disabled || to < 0 || to >= items.length || from === to) return;
    const moved = items[from];
    if (!moved) return;
    onReorder(moveItem(items, from, to), moved);
    setAnnouncement(t('moved', { name: label(moved), position: to + 1 }));
    // keep focus on the moved item's handle
    requestAnimationFrame(() => handles.current[to]?.focus());
  };

  const onKey = (e: KeyboardEvent, index: number, fromHandle: boolean) => {
    if (!(fromHandle || e.altKey)) return;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(index, index - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(index, index + 1);
    }
  };

  return (
    <>
      <ol className={cn('grid gap-2', className)}>
        {items.map((item, index) => (
          <li
            key={item.id}
            data-testid="sortable-item"
            draggable={!disabled}
            onDragStart={(e) => {
              setDragIndex(index);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', item.id);
            }}
            onDragOver={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              setOverIndex(index);
            }}
            onDragLeave={() => setOverIndex((o) => (o === index ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex !== null) move(dragIndex, index);
              setDragIndex(null);
              setOverIndex(null);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setOverIndex(null);
            }}
            onKeyDown={(e) => onKey(e, index, false)}
            className={cn(
              'bg-card flex items-start gap-2 rounded-md border p-2 sm:p-3',
              dragIndex === index && 'opacity-50',
              overIndex === index && dragIndex !== index && 'ring-primary ring-2',
            )}
          >
            <button
              type="button"
              ref={(el) => {
                handles.current[index] = el;
              }}
              aria-label={`${t('dragHandle')}: ${label(item)}`}
              aria-describedby={undefined}
              disabled={disabled}
              onKeyDown={(e) => {
                e.stopPropagation();
                onKey(e, index, true);
              }}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 mt-1 cursor-grab rounded p-1 outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed"
            >
              <GripVertical className="size-4" aria-hidden />
            </button>
            <div className="min-w-0 flex-1">{renderItem(item, index)}</div>
            <div className="flex shrink-0 flex-col gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label={`${t('moveUp')}: ${label(item)}`}
                disabled={disabled || index === 0}
                onClick={() => move(index, index - 1)}
              >
                <ArrowUp aria-hidden />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label={`${t('moveDown')}: ${label(item)}`}
                disabled={disabled || index === items.length - 1}
                onClick={() => move(index, index + 1)}
              >
                <ArrowDown aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  );
}
