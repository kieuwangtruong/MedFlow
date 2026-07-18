import { rooms, routingRecommendation } from '../mocks/data'
import type { AIRecommendation, Priority, Room, SymptomReport } from '../types'
import axiosClient, { mockDelay, USE_MOCK_API } from './axiosClient'

interface SymptomRoutingResponse {
  priority: string
  message: string
  recommendations: {
    department_name: string
    clinic_room: string
    confidence: number
  }[]
}

const toSymptomRoutingPayload = (symptoms: SymptomReport) => ({
  symptom_text: [
    symptoms.description,
    symptoms.commonSymptoms.length ? `Triệu chứng phổ biến: ${symptoms.commonSymptoms.join(', ')}` : '',
    symptoms.dangerSigns.length ? `Dấu hiệu nguy hiểm: ${symptoms.dangerSigns.join(', ')}` : '',
    symptoms.onset ? `Khởi phát: ${symptoms.onset}` : '',
    `Mức độ đau: ${symptoms.painLevel}/10`,
  ].filter(Boolean).join('. '),
  age: 35,
  gender: 'UNKNOWN',
  pregnancy_status: 'NA',
  top_k: 3,
})

const toPriority = (value: string): Priority => {
  if (['EMERGENCY', 'URGENT', 'HIGH', 'NORMAL', 'LOW'].includes(value)) return value as Priority
  return 'NORMAL'
}

const toAIRecommendation = (response: SymptomRoutingResponse): AIRecommendation => {
  const topRecommendation = response.recommendations[0]

  return {
    department: topRecommendation?.department_name ?? routingRecommendation.department,
    room: topRecommendation?.clinic_room ?? routingRecommendation.room,
    floor: routingRecommendation.floor,
    estimatedWait: routingRecommendation.estimatedWait,
    waitingCount: routingRecommendation.waitingCount,
    reason: response.message,
    confidence: topRecommendation?.confidence ?? routingRecommendation.confidence,
    priority: toPriority(response.priority),
  }
}

export const aiApi = {
  symptomRouting: async (_visitId: string, symptoms: SymptomReport): Promise<AIRecommendation> => {
    if (USE_MOCK_API) return mockDelay(routingRecommendation, 1200)

    const response = await axiosClient.post<SymptomRoutingResponse>('/symptom-routing', toSymptomRoutingPayload(symptoms))
    return toAIRecommendation(response.data)
  },
  fastestRoom: async (payload: object): Promise<Room[]> => USE_MOCK_API ? mockDelay(rooms.filter((room) => room.status === 'OPEN')) : (await axiosClient.post<Room[]>('/ai/fastest-room', payload)).data,
}
