import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AIRecommendation } from '../types'

interface VisitState {
  visitId: string | null
  queueNumber: string | null
  recommendation: AIRecommendation | null
  setVisit: (visitId: string, queueNumber: string) => void
  setRecommendation: (recommendation: AIRecommendation) => void
  clearVisit: () => void
}

export const useVisitStore = create<VisitState>()(persist(
  (set) => ({ visitId: null, queueNumber: null, recommendation: null, setVisit: (visitId, queueNumber) => set({ visitId, queueNumber }), setRecommendation: (recommendation) => set({ recommendation }), clearVisit: () => set({ visitId: null, queueNumber: null, recommendation: null }) }),
  { name: 'smart-hospital-visit' },
))
