import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardPlus, FileCheck2, Megaphone, Play, Stethoscope } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { doctorApi } from '../../api/doctorApi'
import { apiErrorMessage } from '../../api/axiosClient'
import type { QueueEntry } from '../../types'
import { priorityClass, priorityLabel } from '../../utils/priority'
import { visitStatusLabel } from '../../utils/status'
import { AppTable, type TableColumn } from '../common/AppTable'
import { Badge } from '../common/Badge'

const taskTypeLabel: Record<QueueEntry['taskType'], string> = {
  INITIAL_CONSULT: 'Khám ban đầu',
  DIAGNOSTIC_SERVICE: 'Dịch vụ chỉ định',
  RETURN_REVIEW: 'Trả kết quả',
}

function announcePatient(patientName: string, queueNumber: string, room: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const speech = new SpeechSynthesisUtterance(`Mời bệnh nhân ${patientName}, số ${queueNumber}, vào ${room}`)
  speech.lang = 'vi-VN'
  speech.rate = 0.9
  window.speechSynthesis.speak(speech)
}

export function DoctorQueueTable({ items }: { items: QueueEntry[] }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const firstWaitingVisitId = items.find((item) => item.status === 'WAITING')?.visitId

  const call = useMutation({
    mutationFn: doctorApi.callVisit,
    onSuccess: (result, visitId) => {
      const row = items.find((item) => item.visitId === visitId)
      announcePatient(result.patientName, result.queueNumber, row?.room ?? 'phòng khám')
      toast.success(`Đã gọi ${result.patientName} · số ${result.queueNumber}`)
      void queryClient.invalidateQueries({ queryKey: ['doctor-queue'] })
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'Không thể gọi bệnh nhân')),
  })
  const start = useMutation({
    mutationFn: doctorApi.startVisit,
    onSuccess: (_result, visitId) => {
      void queryClient.invalidateQueries({ queryKey: ['doctor-queue'] })
      navigate(`/doctor/examination/${visitId}`)
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'Cần gọi bệnh nhân trước khi bắt đầu khám')),
  })
  const validate = useMutation({
    mutationFn: doctorApi.validateResult,
    onSuccess: () => {
      toast.success('Đã kiểm định kết quả và đưa bệnh nhân vào hàng đợi trả kết quả')
      void queryClient.invalidateQueries({ queryKey: ['doctor-queue'] })
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'Không thể kiểm định kết quả')),
  })

  const columns: TableColumn<QueueEntry>[] = [
    {
      key: 'number',
      header: 'Thứ tự',
      render: (row) => <div><strong className="text-lg font-black text-primary">{row.queueNumber}</strong><p className="text-xs text-slate-400">#{row.orderNumber}</p></div>,
    },
    {
      key: 'patient',
      header: 'Bệnh nhân',
      render: (row) => <div><strong className="text-foreground">{row.patientName}</strong><p className="mt-0.5 text-xs text-slate-500">{row.age} tuổi · {row.visitId}</p></div>,
    },
    {
      key: 'type',
      header: 'Loại lượt',
      render: (row) => <div><strong className={row.taskType === 'RETURN_REVIEW' ? 'text-violet-700' : 'text-slate-800'}>{taskTypeLabel[row.taskType]}</strong><p className="mt-0.5 text-xs text-slate-500">{row.department}</p></div>,
    },
    {
      key: 'symptom',
      header: 'Thông tin chính',
      render: (row) => <span className="line-clamp-2 max-w-xs leading-5 text-slate-700">{row.taskType === 'RETURN_REVIEW' ? 'Kết quả đã kiểm định, chờ bác sĩ trả kết quả' : row.mainSymptom}</span>,
    },
    { key: 'priority', header: 'Ưu tiên', render: (row) => <Badge className={priorityClass[row.priority]}>{priorityLabel[row.priority]}</Badge> },
    { key: 'wait', header: 'Đã chờ', render: (row) => <strong className={row.waitedMinutes > 30 ? 'text-red-600' : 'text-slate-800'}>{row.waitedMinutes} phút</strong> },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (row) => <span className="inline-flex items-center gap-2 font-semibold text-slate-700"><span className={`h-2.5 w-2.5 rounded-full ${row.status === 'CALLED' ? 'animate-pulse bg-violet-500' : row.status === 'WAITING_RESULT' ? 'bg-amber-500' : row.status === 'IN_EXAMINATION' ? 'bg-emerald-500' : 'bg-sky-500'}`}/>{visitStatusLabel[row.status]}</span>,
    },
    {
      key: 'action',
      header: 'Thao tác',
      render: (row) => <div className="flex min-w-[250px] flex-wrap gap-2">
        {row.status === 'WAITING' && <button disabled={row.visitId !== firstWaitingVisitId || call.isPending} onClick={() => call.mutate(row.visitId)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#176b9b] px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"><Megaphone size={14}/>{row.visitId === firstWaitingVisitId ? 'Gọi bệnh nhân' : 'Chờ đúng lượt'}</button>}
        {row.status === 'CALLED' && <><button onClick={() => call.mutate(row.visitId)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700"><Megaphone size={14}/>Gọi lại</button><button disabled={start.isPending} onClick={() => start.mutate(row.visitId)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white"><Play size={14}/>Bắt đầu</button></>}
        {row.status === 'IN_EXAMINATION' && <button onClick={() => navigate(`/doctor/examination/${row.visitId}`)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white"><Stethoscope size={14}/>Mở hồ sơ</button>}
        {row.status === 'WAITING_RESULT' && row.taskType === 'DIAGNOSTIC_SERVICE' && <button disabled={validate.isPending} onClick={() => validate.mutate(row.visitId)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white"><FileCheck2 size={14}/>Kiểm định kết quả</button>}
        {row.status === 'IN_EXAMINATION' && row.taskType === 'INITIAL_CONSULT' && <button onClick={() => navigate(`/doctor/orders/${row.visitId}`)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#efc8b8] bg-[#fff8f4] px-3 py-2 text-xs font-bold text-[#9f4b2d]"><ClipboardPlus size={14}/>Chỉ định</button>}
      </div>,
    },
  ]

  return <AppTable columns={columns} data={items} rowKey={(row) => `${row.visitId}-${row.taskType}`}/>
}
