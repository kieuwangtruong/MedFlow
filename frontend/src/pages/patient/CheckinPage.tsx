import { useMutation } from '@tanstack/react-query'
import { AlertCircle, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { patientApi } from '../../api/patientApi'
import { PageHeader } from '../../components/common/PageHeader'
import { CheckinForm } from '../../components/patient/CheckinForm'
import type { CheckinFormData } from '../../schemas/checkinSchema'
import { useAuthStore } from '../../stores/authStore'
import { useVisitStore } from '../../stores/visitStore'

export function CheckinPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const setVisit = useVisitStore((state) => state.setVisit)
  const mutation = useMutation({
    mutationFn: patientApi.checkin,
    onSuccess: ({ visitId, queueNumber, requiresSymptoms, existing }) => {
      setVisit(visitId, queueNumber)
      if (existing && !requiresSymptoms) {
        toast.success('Đã khôi phục lượt khám đang hoạt động')
        navigate('/patient/pathway')
        return
      }
      toast.success('Check-in thành công. Vui lòng khai báo triệu chứng để được phân phòng.')
      navigate('/patient/symptoms')
    },
    onError: () => toast.error('Không thể check-in, vui lòng thử lại'),
  })
  const birthYear = user?.date_of_birth ? new Date(user.date_of_birth).getFullYear().toString() : 'Chưa cập nhật'

  return <>
    <PageHeader title="Lấy số khám" description="Kiểm tra thông tin, check-in rồi khai báo triệu chứng để được phân đúng phòng."/>
    <div className="grid gap-5 lg:grid-cols-[.7fr_1.3fr]">
      <div className="space-y-5">
        <div className="card">
          <span className="icon-box"><UserRound/></span>
          <h2 className="mt-3 text-xl font-bold">{user?.full_name ?? 'Bệnh nhân'}</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="CCCD" value={user?.cccd ?? 'Chưa cập nhật'}/>
            <Row label="Năm sinh" value={birthYear}/>
            <Row label="Số điện thoại" value={user?.phone_number ?? 'Chưa cập nhật'}/>
          </dl>
        </div>
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-orange-800">
          <p className="flex gap-2 font-bold"><AlertCircle/>Quy trình tiếp nhận</p>
          <p className="mt-2 text-sm">Sau check-in, triệu chứng sẽ được bệnh nhân tự khai báo hoặc nhân viên y tế nhập hộ. Hệ thống chỉ cấp số phòng sau khi hoàn tất phân luồng.</p>
        </div>
      </div>
      <CheckinForm loading={mutation.isPending} onSubmit={(data: CheckinFormData) => mutation.mutate(data)}/>
    </div>
  </>
}

const Row = ({ label, value }: { label: string; value: string }) => <div className="flex justify-between gap-3"><dt className="text-slate-500">{label}</dt><dd className="text-right font-semibold text-slate-800">{value}</dd></div>
