import { Activity, AlertTriangle, Clock, Flame } from 'lucide-react'
import type { Priority, SymptomReport } from '../../types'

const ONSET_LABELS: Record<string, string> = {
  today: 'Hôm nay',
  '1-3-days': '1–3 ngày trước',
  week: 'Tuần trước / Khoảng một tuần',
  longer: 'Lâu hơn (mãn tính)',
}

const TRIAGE_GUIDELINES: Record<Priority, string> = {
  EMERGENCY: 'Mức độ CẤP CỨU: Cần tiếp nhận và can thiệp y khoa ngay lập tức (< 5 phút).',
  URGENT: 'Mức độ KHẨN CẤP: Cần thăm khám ưu tiên trong vòng 15 phút.',
  HIGH: 'Mức độ ƯU TIÊN CAO: Cần thăm khám trong vòng 15–20 phút.',
  NORMAL: 'Mức độ BÌNH THƯỜNG: Thăm khám theo thứ tự tiếp nhận tiêu chuẩn (SLA 30 phút).',
  LOW: 'Mức độ KHÔNG KHẨN: Thăm khám thông thường theo thứ tự hàng đợi (SLA 60 phút).',
}

interface SymptomSummaryProps {
  symptom?: string
  symptomPayload?: SymptomReport | null
  priority?: Priority
  severityScore?: number | null
}

export function SymptomSummary({
  symptom = '',
  symptomPayload,
  priority = 'NORMAL',
  severityScore,
}: SymptomSummaryProps) {
  const description = symptomPayload?.description || symptom || 'Bệnh nhân chưa nhập mô tả chi tiết'
  const onset = symptomPayload?.onset ? (ONSET_LABELS[symptomPayload.onset] || symptomPayload.onset) : 'Chưa ghi nhận'
  const painLevel = symptomPayload?.painLevel !== undefined && symptomPayload.painLevel !== null
    ? `${symptomPayload.painLevel}/10`
    : 'Chưa đánh giá'
  const commonSymptoms = symptomPayload?.commonSymptoms || []
  const dangerSigns = symptomPayload?.dangerSigns || []
  const triageNote = TRIAGE_GUIDELINES[priority] || TRIAGE_GUIDELINES.NORMAL

  const toneClass = priority === 'EMERGENCY'
    ? 'border-red-300 bg-red-50 text-red-900'
    : priority === 'URGENT' || priority === 'HIGH'
      ? 'border-orange-300 bg-orange-50 text-orange-900'
      : 'border-blue-200 bg-blue-50 text-blue-900'

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title flex items-center gap-2">
          <Activity size={20} className="text-teal-700" />
          Triệu chứng & Đánh giá Triage
        </h2>
        {severityScore !== null && severityScore !== undefined && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            Điểm phân loại: {severityScore}
          </span>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Mô tả của bệnh nhân</p>
        <p className="mt-1 text-base font-semibold text-slate-900">{description}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
          <Clock size={18} className="text-slate-500 shrink-0" />
          <div>
            <p className="text-xs text-slate-500">Thời gian khởi phát</p>
            <p className="font-bold text-slate-800">{onset}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
          <Flame size={18} className="text-amber-600 shrink-0" />
          <div>
            <p className="text-xs text-slate-500">Mức độ đau</p>
            <p className="font-bold text-slate-800">{painLevel}</p>
          </div>
        </div>
      </div>

      {commonSymptoms.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-500 mb-1.5">Triệu chứng kèm theo:</p>
          <div className="flex flex-wrap gap-1.5">
            {commonSymptoms.map((item) => (
              <span key={item} className="rounded-lg bg-teal-50 border border-teal-200 px-2.5 py-1 text-xs font-semibold text-teal-800">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {dangerSigns.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-600" />
          <div>
            <span className="font-bold">Dấu hiệu cảnh báo nguy hiểm: </span>
            <span>{dangerSigns.join(', ')}</span>
          </div>
        </div>
      )}

      <div className={`rounded-xl border p-3.5 text-sm ${toneClass}`}>
        <strong>Đánh giá triage: </strong>
        {triageNote}
      </div>
    </div>
  )
}
