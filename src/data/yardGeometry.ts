// Schematic slot grids, linked to canonical terminal codes. No operational records.
export const YARD_GRIDS: Record<string, { prefix: string; blocks: number; rows: number; columns: number; levels: number }> = {
  NSFT: { prefix: 'FT', blocks: 12, rows: 6, columns: 12, levels: 4 },
  NSICT: { prefix: 'IC', blocks: 12, rows: 8, columns: 16, levels: 4 },
  NSIGT: { prefix: 'IG', blocks: 6, rows: 8, columns: 14, levels: 4 },
  APMT: { prefix: 'AP', blocks: 12, rows: 6, columns: 14, levels: 4 },
  BMCT: { prefix: 'BM', blocks: 48, rows: 8, columns: 12, levels: 4 },
  NSDT: { prefix: 'DT', blocks: 4, rows: 6, columns: 10, levels: 4 },
}
