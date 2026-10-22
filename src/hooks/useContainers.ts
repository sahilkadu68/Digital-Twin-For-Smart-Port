import { useMemo } from 'react'
import { useAppStore } from '@/store/appStore'
import { useInventory } from './useInventory'

/** Global overview by default; the yard explicitly requests local filters. */
export function useContainers(filtered = false) {
  const inventory = useInventory()
  const { searchQuery, activeTerminal, statusFilter, typeFilter } = useAppStore()
  const containers = useMemo(() => !filtered ? inventory.containers : inventory.containers.filter(c =>
    (activeTerminal === 'all' || c.terminal === activeTerminal)
    && (statusFilter === 'all' || c.status === statusFilter)
    && (typeFilter === 'all' || c.type === typeFilter)
    && (!searchQuery.trim() || [c.containerNumber, c.shippingLine, c.destination, c.origin, c.terminal]
      .some(v => v?.toLowerCase().includes(searchQuery.trim().toLowerCase())))
  ), [inventory.containers, filtered, searchQuery, activeTerminal, statusFilter, typeFilter])
  return { ...inventory, containers }
}

export function useSelectedContainer() {
  const selectedId = useAppStore(s => s.selectedContainerId)
  const setSelectedContainer = useAppStore(s => s.setSelectedContainer)
  const { containers, loading, error } = useInventory()
  const container = containers.find(c => c.id === selectedId) ?? null
  return { container, selectedId, setSelectedContainer, loading, error }
}
