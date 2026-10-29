export interface Page<T> {
  items: T[];
  nextOffset: number | null;
}
