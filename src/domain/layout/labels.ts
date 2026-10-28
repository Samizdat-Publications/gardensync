// Square names as the beds are labelled: columns A, B, C ... (then AA, AB ...), rows 1, 2, 3 ...
import type { Cells } from '../doc/schema';

export function columnLetter(col: number): string {
  let n = col;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export function squareName(col: number, row: number): string {
  return `${columnLetter(col)}${row + 1}`;
}

/** "C1", or "C1 to D2" for a rectangle. */
export function squaresLabel(cells: Cells): string {
  const first = squareName(cells.col, cells.row);
  if (cells.w === 1 && cells.h === 1) return first;
  return `${first} to ${squareName(cells.col + cells.w - 1, cells.row + cells.h - 1)}`;
}
