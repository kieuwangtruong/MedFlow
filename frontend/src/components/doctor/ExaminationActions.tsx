import { CheckCircle2, Play, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { QueueEntry } from '../../types'
import { AppButton } from '../common/AppButton'

export function ExaminationActions({ visitId, status, taskType, onStart, onComplete }: { visitId: string; status: QueueEntry['status']; taskType: QueueEntry['taskType']; onStart: () => void; onComplete: () => void }) {
  return <div className="flex flex-wrap gap-3">
    {status === 'CALLED' && <AppButton onClick={onStart}><Play size={18}/>Bắt đầu {taskType === 'RETURN_REVIEW' ? 'trả kết quả' : 'khám'}</AppButton>}
    {status === 'IN_EXAMINATION' && taskType === 'INITIAL_CONSULT' && <Link to={`/doctor/orders/${visitId}`}><AppButton variant="secondary"><Plus size={18}/>Tạo chỉ định</AppButton></Link>}
    {status === 'IN_EXAMINATION' && <AppButton variant="secondary" onClick={onComplete}><CheckCircle2 size={18}/>{taskType === 'RETURN_REVIEW' ? 'Hoàn tất trả kết quả' : 'Hoàn thành dịch vụ'}</AppButton>}
  </div>
}
