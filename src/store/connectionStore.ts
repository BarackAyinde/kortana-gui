import { create } from 'zustand'

type ConnectionStatus = 'connected' | 'offline'

interface ConnectionState {
  status: ConnectionStatus
  setStatus: (status: ConnectionStatus) => void
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'offline',
  setStatus: (status) => set({ status }),
}))
