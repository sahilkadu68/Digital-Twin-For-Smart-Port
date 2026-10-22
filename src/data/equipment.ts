export type EquipmentStatus = 'active' | 'idle' | 'maintenance'

export interface RTGEquipment {
  id: string
  block: string
  x: number
  z: number
  status: EquipmentStatus
  utilization: number
  liftsPerHour: number
}

