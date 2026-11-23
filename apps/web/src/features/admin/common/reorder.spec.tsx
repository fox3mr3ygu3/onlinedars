// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderAdmin } from '../test-utils';
import { byPosition, moveById, moveItem, orderChanged, orderIds } from './reorder';
import { SortableList } from './SortableList';

const items = [
  { id: 'a', title: 'Kirish', position: 1 },
  { id: 'b', title: "O'zgaruvchilar", position: 2 },
  { id: 'c', title: 'Funksiyalar', position: 3 },
];

describe('reorder helpers', () => {
  it('moveItem moves and clamps without mutating', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveItem(['a', 'b', 'c'], 1, 99)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
    const src = ['a', 'b'];
    moveItem(src, 0, 1);
    expect(src).toEqual(['a', 'b']);
  });

  it('moveById / orderIds / orderChanged / byPosition', () => {
    expect(orderIds(moveById(items, 'c', -1))).toEqual(['a', 'c', 'b']);
    expect(orderIds(moveById(items, 'a', -1))).toEqual(['a', 'b', 'c']);
    expect(orderChanged(items, moveById(items, 'a', 1))).toBe(true);
    expect(orderChanged(items, [...items])).toBe(false);
    expect(orderIds(byPosition([items[2]!, items[0]!, items[1]!]))).toEqual(['a', 'b', 'c']);
  });
});

function Harness({ onReorder }: { onReorder: (ids: string[]) => void }) {
  const [list, setList] = useState(items);
  return (
    <SortableList
      items={list}
      label={(i) => i.title}
      onReorder={(next) => {
        setList(next);
        onReorder(orderIds(next));
      }}
      renderItem={(i) => <span>{i.title}</span>}
    />
  );
}

describe('<SortableList /> keyboard reordering', () => {
  it('arrow keys on the grip handle move the item', async () => {
    const onReorder = vi.fn();
    renderAdmin(<Harness onReorder={onReorder} />);
    const handle = screen.getByRole('button', { name: /Sudrab.*: Kirish/ });
    handle.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(onReorder).toHaveBeenLastCalledWith(['b', 'a', 'c']);
    expect(screen.getByText("Kirish: 2-o'ringa ko'chirildi")).toBeInTheDocument();
  });

  it('up/down buttons move items and are disabled at the edges', async () => {
    const onReorder = vi.fn();
    renderAdmin(<Harness onReorder={onReorder} />);
    expect(screen.getByRole('button', { name: "Yuqoriga ko'chirish: Kirish" })).toBeDisabled();
    expect(screen.getByRole('button', { name: "Pastga ko'chirish: Funksiyalar" })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: "Yuqoriga ko'chirish: Funksiyalar" }));
    expect(onReorder).toHaveBeenLastCalledWith(['a', 'c', 'b']);
  });

  it('Alt+ArrowUp anywhere in the row moves it', () => {
    const onReorder = vi.fn();
    renderAdmin(<Harness onReorder={onReorder} />);
    const rows = screen.getAllByTestId('sortable-item');
    fireEvent.keyDown(rows[2]!, { key: 'ArrowUp', altKey: true });
    expect(onReorder).toHaveBeenLastCalledWith(['a', 'c', 'b']);
  });

  it('drag and drop reorders', () => {
    const onReorder = vi.fn();
    renderAdmin(<Harness onReorder={onReorder} />);
    const rows = screen.getAllByTestId('sortable-item');
    const dataTransfer = { setData: vi.fn(), effectAllowed: '' };
    fireEvent.dragStart(rows[0]!, { dataTransfer });
    fireEvent.dragOver(rows[2]!, { dataTransfer });
    fireEvent.drop(rows[2]!, { dataTransfer });
    expect(onReorder).toHaveBeenLastCalledWith(['b', 'c', 'a']);
  });
});
