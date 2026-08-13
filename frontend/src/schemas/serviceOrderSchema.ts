import { z } from 'zod'

export const serviceOrderSchema = z.object({
  type: z.enum(['X-quang', 'Siêu âm'], { error: 'Chọn loại dịch vụ' }),
  targetDepartment: z.literal('Chẩn đoán hình ảnh'),
  priority: z.enum(['EMERGENCY', 'URGENT', 'HIGH', 'NORMAL', 'LOW']),
  clinicalNote: z.string().min(5, 'Ghi chú cần ít nhất 5 ký tự'),
  specialRequest: z.string().optional(),
})

export type ServiceOrderFormData = z.infer<typeof serviceOrderSchema>
