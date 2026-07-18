import { rooms, routingRecommendation } from '../mocks/data'
import type { AIRecommendation, Priority, Room, SymptomReport } from '../types'
import axiosClient, { mockDelay, USE_MOCK_API } from './axiosClient'

interface SymptomRoutingResponse {
  priority: string
  message: string
  is_red_flag: boolean
  requires_human_review: boolean
  recommendations: {
    department_code: string
    department_name: string
    clinic_room: string
    confidence: number
  }[]
}

export interface SymptomRoutingContext {
  age: number
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN'
  pregnancyStatus: 'YES' | 'NO' | 'NA' | 'UNKNOWN'
}

const toSymptomRoutingPayload = (symptoms: SymptomReport, context?: SymptomRoutingContext) => ({
  symptom_text: [
    symptoms.description,
    symptoms.commonSymptoms.length ? `Triệu chứng phổ biến: ${symptoms.commonSymptoms.join(', ')}` : '',
    symptoms.dangerSigns.length ? `Dấu hiệu nguy hiểm: ${symptoms.dangerSigns.join(', ')}` : '',
    symptoms.onset ? `Khởi phát: ${symptoms.onset}` : '',
    `Mức độ đau: ${symptoms.painLevel}/10`,
  ].filter(Boolean).join('. '),
  age: context?.age ?? 35,
  gender: context?.gender ?? 'UNKNOWN',
  pregnancy_status: context?.pregnancyStatus ?? 'NA',
  top_k: 3,
})

const toPriority = (value: string): Priority => {
  if (['EMERGENCY', 'URGENT', 'HIGH', 'NORMAL', 'LOW'].includes(value)) return value as Priority
  return 'NORMAL'
}

const toAIRecommendation = (response: SymptomRoutingResponse): AIRecommendation => {
  const topRecommendation = response.recommendations[0]
  if (!topRecommendation) throw new Error('API không trả về phòng khám phù hợp')

  return {
    department: topRecommendation.department_name,
    room: topRecommendation.clinic_room,
    floor: routingRecommendation.floor,
    estimatedWait: routingRecommendation.estimatedWait,
    waitingCount: routingRecommendation.waitingCount,
    reason: response.message,
    confidence: topRecommendation.confidence,
    priority: toPriority(response.priority),
    requiresHumanReview: response.requires_human_review,
    isRedFlag: response.is_red_flag,
    alternatives: response.recommendations.slice(1).map((item) => ({
      department: item.department_name,
      room: item.clinic_room,
      confidence: item.confidence,
    })),
  }
}

export const aiApi = {
  symptomRouting: async (_visitId: string, symptoms: SymptomReport, context?: SymptomRoutingContext): Promise<AIRecommendation> => {
    if (USE_MOCK_API) return mockDelay(routingRecommendation, 1200)

    const response = await axiosClient.post<SymptomRoutingResponse>('/symptom-routing', toSymptomRoutingPayload(symptoms, context))
    return toAIRecommendation(response.data)
  },
  patientIntakeRouting: async (symptoms: SymptomReport, context: SymptomRoutingContext): Promise<AIRecommendation> => {
    const response = await axiosClient.post<SymptomRoutingResponse>('/symptom-routing', toSymptomRoutingPayload(symptoms, context))
    const specialistRecommendations = response.data.recommendations.filter((item) => item.department_code !== 'GENERAL')
    if (!specialistRecommendations.length) throw new Error('Chưa tìm được phòng chuyên khoa phù hợp, cần nhân viên xác nhận')

    return toAIRecommendation({
      ...response.data,
      recommendations: specialistRecommendations,
      message: response.data.requires_human_review
        ? 'Đã chọn phương án phòng chuyên khoa phù hợp nhất; cần nhân viên xác nhận trước khi tạo lộ trình.'
        : response.data.message,
    })
  },
  fastestRoom: async (payload: object): Promise<Room[]> => USE_MOCK_API ? mockDelay(rooms.filter((room) => room.status === 'OPEN')) : (await axiosClient.post<Room[]>('/ai/fastest-room', payload)).data,
}
