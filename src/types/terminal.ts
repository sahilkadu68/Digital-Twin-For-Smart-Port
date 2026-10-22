// ── JNPA Terminal definition ─────────────────────────────────────────────────
export interface Terminal {
  /** Short code: NSFT, NSICT, NSIGT, APMT, BMCT, NSDT */
  code: string
  /** Full name */
  name: string
  /** Operating company */
  operator: string
  /** Visualization capacity in thousand TEU; not a live inventory value. */
  yardCapacity: number
  /** Berths available */
  berths: number
  /** Quay length in metres */
  quayLength: number
  capacityMillionTeu?: number
  yardAreaHa?: number
  rtgcCount?: number
  rmqcCount?: number
}

// ── Terminal-level statistics derived from container data ─────────────────────
export interface TerminalStats {
  code: string
  containerCount: number
  utilizationPercent: number
  importCount: number
  exportCount: number
  transshipmentCount: number
}
