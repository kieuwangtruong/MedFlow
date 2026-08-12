import { useQuery } from '@tanstack/react-query'
import { Activity, FileCheck2, Megaphone, Search, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { doctorApi } from '../../api/doctorApi'
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton'
import { PageHeader } from '../../components/common/PageHeader'
import { DoctorQueueTable } from '../../components/doctor/DoctorQueueTable'
import { useAuthStore } from '../../stores/authStore'
import { POLLING } from '../../utils/constants'

export function DoctorQueuePage() {
  const user = useAuthStore((state) => state.user)
  const [search, setSearch] = useState('')
  const query = useQuery({ queryKey: ['doctor-queue'], queryFn: doctorApi.getQueue, refetchInterval: POLLING.doctorQueue })
  const assignmentQuery = useQuery({ queryKey: ['doctor-assignment'], queryFn: doctorApi.getAssignment })
  const items = useMemo(() => query.data ?? [], [query.data])
  const filtered = useMemo(() => items.filter((item) => `${item.patientName} ${item.queueNumber} ${item.mainSymptom} ${item.department}`.toLowerCase().includes(search.toLowerCase())), [items, search])
  const assignment = assignmentQuery.data

  return <>
    <PageHeader
      title={assignment?.room.name ?? 'Chưa được phân công phòng'}
      description={assignment ? `${user?.full_name ?? 'Bác sĩ'} · Tầng ${assignment.room.floor} · ${assignment.room.department}` : 'Liên hệ điều phối viên để nhận ca trực.'}
      action={<span className={`rounded-full px-3 py-2 text-sm font-bold ${assignment ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{assignment ? 'Ca trực đang hoạt động' : 'Chưa có ca trực'}</span>}
    />
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Summary icon={<Users/>} label="Đang chờ đúng lượt" value={items.filter((item) => item.status === 'WAITING').length}/>
      <Summary icon={<Megaphone/>} label="Đã gọi" value={items.filter((item) => item.status === 'CALLED').length}/>
      <Summary icon={<Activity/>} label="Đang thực hiện" value={items.filter((item) => item.status === 'IN_EXAMINATION').length}/>
      <Summary icon={<FileCheck2/>} label="Chờ kiểm định" value={items.filter((item) => item.status === 'WAITING_RESULT').length}/>
    </div>
    <section className="min-w-0">
      <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div><h2 className="text-xl font-extrabold text-slate-950">Bảng quản lý hàng đợi</h2><p className="mt-1 text-sm text-slate-500">Gọi theo số thứ tự; lượt trả kết quả chỉ xuất hiện sau khi phòng chỉ định kiểm định.</p></div>
        <label className="relative w-full sm:w-80"><Search className="absolute left-3 top-3 text-slate-400" size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} className="form-control h-11 pl-10" placeholder="Tìm số, tên, triệu chứng..."/></label>
      </div>
      {query.isLoading || assignmentQuery.isLoading ? <LoadingSkeleton/> : <DoctorQueueTable items={filtered}/>} 
    </section>
  </>
}

function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-[#125f52]">{icon}</span><div><span className="text-sm font-semibold text-slate-500">{label}</span><div className="text-2xl font-extrabold text-slate-950">{value}</div></div></div>
}
