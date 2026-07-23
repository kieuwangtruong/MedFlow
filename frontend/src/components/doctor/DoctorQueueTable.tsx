import { ClipboardPlus, Play, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import type { QueueEntry, VisitStatus } from '../../types'
import { priorityClass, priorityLabel } from '../../utils/priority'
import { visitStatusLabel } from '../../utils/status'
import { AppTable, type TableColumn } from '../common/AppTable'
import { Badge } from '../common/Badge'

export function DoctorQueueTable({ items }: { items: QueueEntry[] }) {
  const [statuses, setStatuses] = useState<Record<string, VisitStatus>>({})
  const setStatus = (id: string, status: VisitStatus) => {
    setStatuses((old) => ({ ...old, [id]: status }))
    toast.success(status === 'IN_EXAMINATION' ? 'Đã chuyển bệnh nhân sang đang khám' : 'Đã đưa bệnh nhân về hàng đợi')
  }

  const columns: TableColumn<QueueEntry>[] = [
    { key: 'number', header: 'Số', render: (row) => <strong className="text-lg font-black text-primary">{row.queueNumber}</strong> },
    { key: 'patient', header: 'Bệnh nhân', render: (row) => <div><strong className="text-foreground">{row.patientName}</strong><p className="mt-0.5 text-xs text-slate-500">{row.age} tuổi · {row.visitId}</p></div> },
    { key: 'symptom', header: 'Triệu chứng chính', render: (row) => <span className="line-clamp-2 max-w-xs leading-5 text-slate-700">{row.mainSymptom}</span> },
    { key: 'priority', header: 'Ưu tiên', render: (row) => <Badge className={priorityClass[row.priority]}>{priorityLabel[row.priority]}</Badge> },
    { key: 'wait', header: 'Đã chờ', render: (row) => <strong className={row.waitedMinutes > 30 ? 'text-red-600' : 'text-slate-800'}>{row.waitedMinutes} phút</strong> },
    { key: 'status', header: 'Trạng thái', render: (row) => <span className="inline-flex items-center gap-2 font-semibold text-slate-700"><span className="h-2 w-2 rounded-full bg-sky-500"/>{visitStatusLabel[statuses[row.visitId] ?? row.status]}</span> },
    { key: 'action', header: 'Thao tác', render: (row) => <div className="flex min-w-[270px] flex-wrap gap-2">
      <Link to={`/doctor/examination/${row.visitId}`} onClick={() => setStatus(row.visitId, 'IN_EXAMINATION')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#0f5f78]"><Play size={14}/>Bắt đầu khám</Link>
      <button onClick={() => setStatus(row.visitId, 'WAITING')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"><RotateCcw size={14}/>Chờ lại</button>
      <Link to={`/doctor/orders/${row.visitId}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#efc8b8] bg-[#fff8f4] px-3 py-2 text-xs font-bold text-[#9f4b2d] transition hover:bg-[#fff1e9]"><ClipboardPlus size={14}/>Chỉ định</Link>
    </div> },
  ]

  return <AppTable columns={columns} data={items} rowKey={(row) => row.visitId}/>
}
