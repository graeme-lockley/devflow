export interface BoardColumn {
  name: string;
}

export interface BoardState {
  columns: BoardColumn[];
}

export function createBoardState(columnNames: string[]): BoardState {
  return {
    columns: columnNames.map((name) => ({ name })),
  };
}
