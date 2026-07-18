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
  const setStatus = (id: string, status: VisitStatus) => { setStatuses((old) => ({ ...old, [id]: status })); toast.success(status === 'IN_EXAMINATION' ? 'Đã chuyển bệnh nhân sang đang khám' : 'Đã đưa bệnh nhân về hàng đợi') }
  const columns: TableColumn<QueueEntry>[] = [
    { key: 'number', header: 'Số', render: (row) => <strong className="text-lg text-[#176b9b]">{row.queueNumber}</strong> },
    { key: 'patient', header: 'Bệnh nhân', render: (row) => <div><strong>{row.patientName}</strong><p className="text-xs text-slate-500">{row.age} tuổi · {row.visitId}</p></div> },
    { key: 'symptom', header: 'Triệu chứng chính', render: (row) => <span className="line-clamp-2 max-w-xs">{row.mainSymptom}</span> },
    { key: 'priority', header: 'Ưu tiên', render: (row) => <Badge className={priorityClass[row.priority]}>{priorityLabel[row.priority]}</Badge> },
    { key: 'wait', header: 'Đã chờ', render: (row) => <strong className={row.waitedMinutes > 30 ? 'text-red-600' : ''}>{row.waitedMinutes} phút</strong> },
    { key: 'status', header: 'Trạng thái', render: (row) => <span className="font-semibold text-slate-700">{visitStatusLabel[statuses[row.visitId] ?? row.status]}</span> },
    { key: 'action', header: 'Thao tác', render: (row) => <div className="flex min-w-56 flex-wrap gap-2"><button onClick={() => setStatus(row.visitId, 'IN_EXAMINATION')} className="inline-flex items-center gap-1 rounded-md bg-[#176b9b] px-2.5 py-2 text-xs font-bold text-white"><Play size={14}/>Đang khám</button><button onClick={() => setStatus(row.visitId, 'WAITING')} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-2 text-xs font-bold text-slate-700"><RotateCcw size={14}/>Đang đợi</button><Link to={`/doctor/orders/${row.visitId}`} className="inline-flex items-center gap-1 rounded-md border border-[#f0c5b4] bg-[#fff7f2] px-2.5 py-2 text-xs font-bold text-[#a54c2d]"><ClipboardPlus size={14}/>Khám thêm</Link></div> },
  ]
  return <AppTable columns={columns} data={items} rowKey={(row) => row.visitId}/>
}
