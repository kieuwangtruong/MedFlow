import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { serviceOrderSchema, type ServiceOrderFormData } from '../../schemas/serviceOrderSchema'
import { AppButton } from '../common/AppButton'

export function ServiceOrderForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: ServiceOrderFormData) => void
  loading?: boolean
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ServiceOrderFormData>({
    resolver: zodResolver(serviceOrderSchema),
    defaultValues: {
      targetDepartment: 'Chẩn đoán hình ảnh',
      priority: 'NORMAL',
      clinicalNote: '',
      specialRequest: '',
    },
  })

  return (
    <form className="card space-y-5" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Loại dịch vụ">
          <select {...register('type')} className="form-control">
            <option value="">Chọn dịch vụ</option>
            <option value="X-quang">X-quang</option>
            <option value="Siêu âm">Siêu âm</option>
          </select>
          <p className="mt-1 text-sm text-red-600">{errors.type?.message}</p>
        </Field>
        <Field label="Khoa đích">
          <input {...register('targetDepartment')} className="form-control bg-slate-50" readOnly/>
          <p className="mt-1 text-xs text-slate-500">Khoa đích được xác định theo loại dịch vụ.</p>
        </Field>
        <Field label="Mức ưu tiên">
          <select {...register('priority')} className="form-control">
            <option value="NORMAL">Bình thường</option>
            <option value="HIGH">Ưu tiên cao</option>
            <option value="URGENT">Khẩn cấp</option>
          </select>
        </Field>
      </div>
      <Field label="Ghi chú lâm sàng">
        <textarea {...register('clinicalNote')} className="form-control" rows={4}/>
        <p className="mt-1 text-sm text-red-600">{errors.clinicalNote?.message}</p>
      </Field>
      <Field label="Yêu cầu đặc biệt">
        <input {...register('specialRequest')} className="form-control"/>
      </Field>
      <div className="rounded-xl bg-teal-50 p-4 text-sm text-teal-900">
        Hệ thống chỉ so sánh thời gian chờ giữa các phòng đang mở và hỗ trợ đúng dịch vụ.
      </div>
      <AppButton loading={loading} type="submit">Tìm phòng phù hợp</AppButton>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="field-label">{label}</span>{children}</label>
}
