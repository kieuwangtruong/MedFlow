import { useMutation } from '@tanstack/react-query'
import { BrainCircuit, CheckCircle2, TriangleAlert } from 'lucide-react'
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
  const rooms = useMutation({
    mutationFn: (data: ServiceOrderFormData) => aiApi.fastestRoom({ ...data, visitId }),
    onSuccess: (data) => setSelectedRoom(data[0]?.id),
    onError: () => {
      setSelectedRoom(undefined)
      toast.error('Không có phòng đang mở hỗ trợ dịch vụ đã chọn')
    },
  })
  const create = useMutation({
    mutationFn: (data: ServiceOrderFormData) => doctorApi.createOrder(visitId, {
      ...data,
      room: selectedRoom,
    }),
    onSuccess: () => {
      setCreated(true)
      toast.success('Đã tạo chỉ định và cập nhật lộ trình bệnh nhân')
    },
    onError: () => toast.error('Phòng đã chọn không còn phù hợp hoặc đang đóng'),
  })
  const submit = (data: ServiceOrderFormData) => {
    setDraft(data)
    setCreated(false)
    setSelectedRoom(undefined)
    rooms.mutate(data)
  }

  if (created) {
    return <>
      <PageHeader title="Tạo chỉ định dịch vụ"/>
      <div className="card mx-auto max-w-xl text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 size={34}/>
        </span>
        <h2 className="mt-4 text-2xl font-black">Tạo chỉ định thành công</h2>
        <p className="mt-2 text-slate-500">
          Bước dịch vụ mới đã được thêm vào lộ trình và bệnh nhân sẽ nhận được thông báo.
        </p>
        <AppButton
          className="mt-6"
          onClick={() => {
            setCreated(false)
            setDraft(null)
            setSelectedRoom(undefined)
            rooms.reset()
          }}
        >
          Tạo chỉ định khác
        </AppButton>
      </div>
    </>
  }

  return <>
    <PageHeader title="Tạo chỉ định dịch vụ" description={`Lượt khám ${visitId}`}/>
    <div className="grid gap-5 xl:grid-cols-[1fr_.8fr]">
      <ServiceOrderForm loading={create.isPending || rooms.isPending} onSubmit={submit}/>
      <div>
        {rooms.isPending && (
          <div className="card">
            <p className="mb-4 flex items-center gap-2 font-bold text-teal-800">
              <BrainCircuit className="animate-pulse"/>Đang kiểm tra các phòng tương thích...
            </p>
            <LoadingSkeleton rows={4}/>
          </div>
        )}
        {rooms.isError && (
          <div className="card border-red-200 bg-red-50 text-red-900">
            <TriangleAlert className="mx-auto" size={42}/>
            <h2 className="mt-3 text-center text-lg font-extrabold">Không có phòng phù hợp</h2>
            <p className="mt-2 text-center text-sm">
              Hệ thống không chuyển bệnh nhân sang khoa khác. Hãy kiểm tra trạng thái phòng Chẩn đoán hình ảnh.
            </p>
          </div>
        )}
        {rooms.isSuccess && rooms.data.length > 0 && draft && (
          <div className="card">
            <h2 className="section-title mb-2"><BrainCircuit/>Phòng phù hợp</h2>
            <p className="mb-4 text-sm text-slate-500">
              Chỉ hiển thị phòng đang mở và có hàng đợi hỗ trợ {draft.type}.
            </p>
            <RoomRecommendationList rooms={rooms.data} selected={selectedRoom} onSelect={setSelectedRoom}/>
            <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              Thời gian chờ chỉ dùng để xếp hạng sau khi hệ thống đã kiểm tra đúng khoa và đúng dịch vụ.
            </div>
            <AppButton
              className="mt-4 w-full"
              disabled={!selectedRoom}
              loading={create.isPending}
              onClick={() => create.mutate(draft)}
            >
              Xác nhận phòng và tạo chỉ định
            </AppButton>
          </div>
        )}
        {!rooms.isPending && !rooms.isSuccess && !rooms.isError && (
          <div className="card text-center text-slate-500">
            <BrainCircuit className="mx-auto mb-3 text-teal-700" size={40}/>
            <p className="font-bold text-slate-800">Phòng phù hợp sẽ xuất hiện tại đây</p>
            <p className="mt-1 text-sm">Hệ thống kiểm tra đúng khoa, khả năng phục vụ và trạng thái phòng.</p>
          </div>
        )}
      </div>
    </div>
  </>
}
