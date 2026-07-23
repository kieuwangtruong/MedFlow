import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, MessageSquareWarning, X } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { doctorApi } from '../../api/doctorApi'
import { AppButton } from '../../components/common/AppButton'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton'
import { PageHeader } from '../../components/common/PageHeader'
import { AIRecommendationPanel } from '../../components/doctor/AIRecommendationPanel'
import { ExaminationActions } from '../../components/doctor/ExaminationActions'
import { PatientSummaryCard } from '../../components/doctor/PatientSummaryCard'
import { PrioritySelector } from '../../components/doctor/PrioritySelector'
import { SymptomSummary } from '../../components/doctor/SymptomSummary'
import type { Priority } from '../../types'

type ConfirmAction = 'complete' | 'override' | null
export function ExaminationPage() {
  const queryClient = useQueryClient()
  const { visitId = '' } = useParams()
  const [priority, setPriority] = useState<Priority>('EMERGENCY')
  const [notes, setNotes] = useState('')
  const [aiDecision, setAiDecision] = useState<'PENDING' | 'ACCEPTED' | 'REJECTED'>('PENDING')
  const [rejectReason, setRejectReason] = useState('')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const query = useQuery({ queryKey: ['doctor-visit', visitId], queryFn: () => doctorApi.getVisit(visitId) })
  const start = useMutation({
    mutationFn: () => doctorApi.startVisit(visitId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['doctor-queue'] })
      toast.success('Đã bắt đầu khám, đồng hồ thời gian đã chạy')
    },
    onError: () => toast.error('Không thể bắt đầu lượt khám này'),
  })
  const update = useMutation({ mutationFn: () => doctorApi.updatePriority(visitId, priority), onSuccess: () => toast.success('Đã lưu quyết định lâm sàng') })
  const complete = useMutation({ mutationFn: () => doctorApi.completeVisit(visitId), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['doctor-queue'] }); toast.success('Đã hoàn thành khám và cập nhật bệnh nhân') } })
  if (query.isLoading) return <LoadingSkeleton/>
  const data = query.data!
  const rejectAI = () => { if (rejectReason.trim().length < 10) { toast.error('Vui lòng nhập lý do từ chối ít nhất 10 ký tự'); return } setConfirmAction('override') }
  const confirm = () => { if (confirmAction === 'complete') complete.mutate(); if (confirmAction === 'override') { setAiDecision('REJECTED'); toast.success('Đã ghi nhận quyết định ghi đè AI') } setConfirmAction(null) }
  return <><PageHeader title={`Khám bệnh · ${data.queue.queueNumber}`} description={`Mã lượt khám ${visitId}`} action={<ExaminationActions visitId={visitId} onStart={() => start.mutate()} onComplete={() => setConfirmAction('complete')}/>}/><div className="grid gap-5 xl:grid-cols-2"><PatientSummaryCard patient={data.queue}/><SymptomSummary symptom={data.queue.mainSymptom}/></div><div className="mt-5 grid gap-5 xl:grid-cols-[.65fr_1.35fr]"><div className="card space-y-4"><h2 className="section-title">Quyết định bác sĩ</h2><PrioritySelector value={priority} onChange={setPriority}/><label><span className="field-label">Ghi chú khám</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="form-control" rows={5} placeholder="Nhập nhận định, dấu hiệu lâm sàng..."/></label><label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"><input type="checkbox" className="h-5 w-5 accent-teal-700"/>Cần điều phối sang phòng khác</label><AppButton variant="secondary" onClick={() => update.mutate()} loading={update.isPending}>Lưu ghi chú và ưu tiên</AppButton></div><div><AIRecommendationPanel recommendation={data.recommendation}/><div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">{aiDecision === 'PENDING' ? <div className="space-y-3"><p className="font-bold">Quyết định với đề xuất AI</p><div className="flex flex-wrap gap-3"><AppButton onClick={() => { setAiDecision('ACCEPTED'); toast.success('Đã chấp nhận đề xuất AI') }}><Check size={18}/>Chấp nhận</AppButton><AppButton variant="secondary" onClick={() => setAiDecision('REJECTED')}><X size={18}/>Từ chối</AppButton></div></div> : aiDecision === 'ACCEPTED' ? <p className="flex items-center gap-2 font-bold text-emerald-700"><Check/>Đã chấp nhận đề xuất AI</p> : <div className="space-y-3"><p className="flex gap-2 font-bold text-orange-800"><MessageSquareWarning/>Ghi rõ lý do bác sĩ không sử dụng đề xuất</p><textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="form-control" rows={3} placeholder="Lý do chuyên môn hoặc vận hành..."/><div className="flex gap-2"><AppButton variant="danger" onClick={rejectAI}>Xác nhận ghi đè</AppButton><AppButton variant="ghost" onClick={() => setAiDecision('PENDING')}>Quay lại</AppButton></div></div>}</div></div></div><ConfirmDialog open={Boolean(confirmAction)} title={confirmAction === 'complete' ? 'Hoàn thành lượt khám?' : 'Ghi đè đề xuất AI?'} message={confirmAction === 'complete' ? 'Bệnh nhân sẽ được chuyển sang bước tiếp theo hoặc hoàn thành lộ trình.' : 'Quyết định và lý do sẽ được lưu vào nhật ký kiểm toán.'} onCancel={() => setConfirmAction(null)} onConfirm={confirm}/></>
}
