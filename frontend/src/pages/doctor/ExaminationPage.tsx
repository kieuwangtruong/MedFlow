import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileCheck2, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { doctorApi } from '../../api/doctorApi'
import { AppButton } from '../../components/common/AppButton'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton'
import { PageHeader } from '../../components/common/PageHeader'
import { ExaminationActions } from '../../components/doctor/ExaminationActions'
import { PatientSummaryCard } from '../../components/doctor/PatientSummaryCard'
import { PrioritySelector } from '../../components/doctor/PrioritySelector'
import { SymptomSummary } from '../../components/doctor/SymptomSummary'
import type { Priority } from '../../types'
import { formatDateTime } from '../../utils/date'

export function ExaminationPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { visitId = '' } = useParams()
  const [priority, setPriority] = useState<Priority>('EMERGENCY')
  const [notes, setNotes] = useState('')
  const [confirmComplete, setConfirmComplete] = useState(false)
  const query = useQuery({
    queryKey: ['doctor-visit', visitId],
    queryFn: () => doctorApi.getVisit(visitId),
  })
  const start = useMutation({
    mutationFn: () => doctorApi.startVisit(visitId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['doctor-queue'] })
      void queryClient.invalidateQueries({ queryKey: ['doctor-visit', visitId] })
      toast.success('Đã bắt đầu tiếp nhận bệnh nhân')
    },
    onError: () => toast.error('Cần gọi bệnh nhân từ bảng hàng đợi trước khi bắt đầu'),
  })
  const update = useMutation({
    mutationFn: () => doctorApi.updatePriority(visitId, priority),
    onSuccess: () => toast.success('Đã lưu mức ưu tiên'),
  })
  const complete = useMutation({
    mutationFn: () => doctorApi.completeVisit(visitId),
    onSuccess: (result: { status?: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['doctor-queue'] })
      toast.success(
        result.status === 'WAITING_RESULT'
          ? 'Dịch vụ đã hoàn tất, kết quả đang chờ kiểm định'
          : 'Đã hoàn tất bước xử lý',
      )
      navigate('/doctor/queue')
    },
    onError: () => toast.error('Không thể hoàn tất bước xử lý này'),
  })

  if (query.isLoading) return <LoadingSkeleton/>
  if (!query.data) {
    return <PageHeader title="Không tìm thấy lượt khám" description="Lượt này không còn thuộc hàng đợi của phòng hiện tại."/>
  }

  const data = query.data
  const isResultReview = data.queue.taskType === 'RETURN_REVIEW'
  const confirmCompletion = () => {
    complete.mutate()
    setConfirmComplete(false)
  }
  const actions = (
    <ExaminationActions
      visitId={visitId}
      status={data.queue.status}
      taskType={data.queue.taskType}
      onStart={() => start.mutate()}
      onComplete={() => setConfirmComplete(true)}
    />
  )

  if (isResultReview) {
    return <>
      <PageHeader
        title={`Trả kết quả · ${data.queue.queueNumber}`}
        description={`Lượt quay lại ${visitId} · chỉ mở sau khi kết quả đã được kiểm định`}
        action={actions}
      />
      <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
        <PatientSummaryCard patient={data.queue}/>
        <section className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 bg-violet-700 px-5 py-4 text-white">
            <ShieldCheck/>
            <div>
              <p className="text-sm text-violet-100">Hồ sơ trả kết quả</p>
              <h2 className="text-xl font-extrabold">Kết quả đã được phòng chỉ định kiểm định</h2>
            </div>
          </div>
          <div className="space-y-3 p-5">
            {data.validatedResults.length ? data.validatedResults.map((result) => (
              <div key={result.id} className="flex flex-col justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center">
                <div>
                  <p className="font-extrabold text-emerald-950">{result.serviceName}</p>
                  <p className="mt-1 text-sm text-emerald-800">{result.room} · kiểm định lúc {formatDateTime(result.validatedAt)}</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-emerald-700">
                  <FileCheck2 size={16}/>Đã kiểm định
                </span>
              </div>
            )) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                Chưa có kết quả đã kiểm định. Không được trả kết quả cho bệnh nhân.
              </div>
            )}
          </div>
        </section>
      </div>
      <section className="mt-5 card">
        <h2 className="section-title">Kết luận và hướng dẫn sau kết quả</h2>
        <p className="mt-2 text-sm text-slate-500">
          Đây là lượt trả kết quả, không phải khám ban đầu. Bác sĩ đối chiếu kết quả đã kiểm định trước khi kết luận.
        </p>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="form-control mt-4"
          rows={6}
          placeholder="Nhập kết luận, hướng điều trị và lịch tái khám..."
        />
      </section>
      <ConfirmDialog
        open={confirmComplete}
        title="Hoàn tất trả kết quả?"
        message="Bệnh nhân sẽ kết thúc lượt quay lại sau khi bác sĩ đã giải thích kết quả và hướng dẫn tiếp theo."
        onCancel={() => setConfirmComplete(false)}
        onConfirm={confirmCompletion}
      />
    </>
  }

  return <>
    <PageHeader title={`Khám bệnh · ${data.queue.queueNumber}`} description={`Mã lượt khám ${visitId}`} action={actions}/>
    <div className="grid gap-5 xl:grid-cols-2">
      <PatientSummaryCard patient={data.queue}/>
      <SymptomSummary symptom={data.queue.mainSymptom}/>
    </div>
    <div className="mt-5">
      <div className="card max-w-3xl space-y-4">
        <h2 className="section-title">Quyết định bác sĩ</h2>
        <PrioritySelector value={priority} onChange={setPriority}/>
        <label>
          <span className="field-label">Ghi chú khám</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="form-control"
            rows={5}
            placeholder="Nhập nhận định, dấu hiệu lâm sàng..."
          />
        </label>
        <AppButton variant="secondary" onClick={() => update.mutate()} loading={update.isPending}>
          Lưu mức ưu tiên
        </AppButton>
      </div>
    </div>
    <ConfirmDialog
      open={confirmComplete}
      title="Hoàn thành bước hiện tại?"
      message="Nếu đây là dịch vụ chẩn đoán, kết quả sẽ chuyển sang trạng thái chờ kiểm định và chưa đưa bệnh nhân về phòng ban đầu."
      onCancel={() => setConfirmComplete(false)}
      onConfirm={confirmCompletion}
    />
  </>
}
