import { createContext, useContext } from 'react'

export const MapRefContext = createContext(null)

export function useMapRef() {
  return useContext(MapRefContext)
}
