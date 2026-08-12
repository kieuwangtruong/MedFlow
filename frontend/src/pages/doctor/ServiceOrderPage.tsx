import { useMutation } from '@tanstack/react-query'
import { BrainCircuit, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { aiApi } from '../../api/aiApi'
import { doctorApi } from '../../api/doctorApi'
import { AppButton } from '../../components/common/AppButton'
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton'
import { PageHeader } from '../../components/common/PageHeader'
import { RoomRecommendationList } from '../../components/doctor/RoomRecommendationList'
import { ServiceOrderForm } from '../../components/doctor/ServiceOrderForm'
import type { ServiceOrderFormData } from '../../schemas/serviceOrderSchema'

export function ServiceOrderPage() {
  const { visitId = '' } = useParams()
  const [draft, setDraft] = useState<ServiceOrderFormData | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<string>()
  const [created, setCreated] = useState(false)
  const rooms = useMutation({ mutationFn: (data: ServiceOrderFormData) => aiApi.fastestRoom({ ...data, visitId }), onSuccess: (data) => setSelectedRoom(data[0]?.id) })
  const create = useMutation({ mutationFn: (data: ServiceOrderFormData) => doctorApi.createOrder(visitId, { ...data, room: selectedRoom }), onSuccess: () => { setCreated(true); toast.success('Đã tạo chỉ định và cập nhật lộ trình bệnh nhân') }, onError: () => toast.error('Không thể tạo chỉ định') })
  const submit = (data: ServiceOrderFormData) => { setDraft(data); setCreated(false); if (data.useAI) rooms.mutate(data); else create.mutate(data) }
  if (created) return <><PageHeader title="Tạo chỉ định dịch vụ"/><div className="card mx-auto max-w-xl text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 size={34}/></span><h2 className="mt-4 text-2xl font-black">Tạo chỉ định thành công</h2><p className="mt-2 text-slate-500">Bước dịch vụ mới đã được thêm vào lộ trình và bệnh nhân sẽ nhận được thông báo.</p><AppButton className="mt-6" onClick={() => { setCreated(false); setDraft(null); rooms.reset() }}>Tạo chỉ định khác</AppButton></div></>
  return <><PageHeader title="Tạo chỉ định dịch vụ" description={`Lượt khám ${visitId}`}/><div className="grid gap-5 xl:grid-cols-[1fr_.8fr]"><ServiceOrderForm loading={create.isPending || rooms.isPending} onSubmit={submit}/><div>{rooms.isPending && <div className="card"><p className="mb-4 flex items-center gap-2 font-bold text-teal-800"><BrainCircuit className="animate-pulse"/>AI đang so sánh tải các phòng...</p><LoadingSkeleton rows={4}/></div>}{rooms.data && draft && <div className="card"><h2 className="section-title mb-2"><BrainCircuit/>Phòng chờ nhanh nhất</h2><p className="mb-4 text-sm text-slate-500">Xếp hạng dựa trên hàng đợi, trạng thái và vị trí phòng.</p><RoomRecommendationList rooms={rooms.data} selected={selectedRoom} onSelect={setSelectedRoom}/><div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">AI chỉ hỗ trợ điều phối. Bác sĩ chịu trách nhiệm lựa chọn cuối cùng.</div><AppButton className="mt-4 w-full" disabled={!selectedRoom} loading={create.isPending} onClick={() => create.mutate(draft)}>Xác nhận phòng và tạo chỉ định</AppButton></div>}{!rooms.data && !rooms.isPending && <div className="card text-center text-slate-500"><BrainCircuit className="mx-auto mb-3 text-teal-700" size={40}/><p className="font-bold text-slate-800">Đề xuất phòng sẽ xuất hiện tại đây</p><p className="mt-1 text-sm">Hoàn thành biểu mẫu và bật lựa chọn AI.</p></div>}</div></div></>
}
