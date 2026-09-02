import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardPlus, LoaderCircle, MapPin, Stethoscope, UserRound } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { aiApi } from '../../api/aiApi'
import { doctorApi } from '../../api/doctorApi'
import { PageHeader } from '../../components/common/PageHeader'
import type { AIRecommendation, SymptomReport } from '../../types'

type IntakeForm = {
  cccd: string
  name: string
  age: string
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN'
  pregnancyStatus: 'YES' | 'NO' | 'NA' | 'UNKNOWN'
  symptoms: string
}

type IntakeResult = Awaited<ReturnType<typeof doctorApi.createIntake>>

export function PatientIntakePage() {
  const [form, setForm] = useState<IntakeForm>({
    cccd: '',
    name: '',
    age: '',
    gender: 'UNKNOWN',
    pregnancyStatus: 'NA',
    symptoms: '',
  })
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [result, setResult] = useState<IntakeResult | null>(null)

  const update = (key: keyof IntakeForm, value: string) => setForm((old) => ({ ...old, [key]: value }))
  const symptomReport = (): SymptomReport => ({
    description: form.symptoms.trim(),
    onset: '',
    painLevel: 0,
    commonSymptoms: [],
    dangerSigns: [],
  })

  const validationError = () => {
    if (!/^\d{9,12}$/.test(form.cccd)) return 'CCCD cần gồm 9 đến 12 chữ số'
    if (form.name.trim().length < 2) return 'Vui lòng nhập họ tên bệnh nhân'
    const age = Number(form.age)
    if (!Number.isInteger(age) || age < 0 || age > 120) return 'Tuổi cần nằm trong khoảng 0 đến 120'
    if (form.symptoms.trim().length < 5) return 'Mô tả triệu chứng cần ít nhất 5 ký tự'
    return null
  }

  const routing = useMutation({
    mutationFn: () => aiApi.patientIntakeRouting(symptomReport(), {
      age: Number(form.age),
      gender: form.gender,
      pregnancyStatus: form.gender === 'FEMALE' ? form.pregnancyStatus : 'NA',
    }),
    onSuccess: (next) => {
      setRecommendation(next)
      setSelectedRoom(next.room)
      setResult(null)
      toast.success('Đã có đề xuất phân phòng')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể gọi AI phân luồng'),
  })

  const create = useMutation({
    mutationFn: async () => {
      if (!recommendation || !selectedRoom) throw new Error('Vui lòng chọn phòng tiếp nhận')
      const options = [{ department: recommendation.department, room: recommendation.room }, ...(recommendation.alternatives ?? [])]
      const selected = options.find((item) => item.room === selectedRoom)
      return doctorApi.createIntake({
        cccd: form.cccd,
        name: form.name.trim(),
        age: Number(form.age),
        gender: form.gender,
        pregnancyStatus: form.gender === 'FEMALE' ? form.pregnancyStatus : 'NA',
        department: selected?.department ?? recommendation.department,
        room: selectedRoom,
        estimatedWait: recommendation.estimatedWait,
        symptomReport: symptomReport(),
      })
    },
    onSuccess: (created) => {
      setResult(created)
      toast.success(`Đã tạo lộ trình ${created.visitId}`)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể tạo lượt khám'),
  })

  const submitRouting = () => {
    const error = validationError()
    if (error) return toast.error(error)
    routing.mutate()
  }

  const options = recommendation
    ? [{ department: recommendation.department, room: recommendation.room, confidence: recommendation.confidence }, ...(recommendation.alternatives ?? [])].slice(0, 3)
    : []

  return (
    <>
      <PageHeader
        title="Tiếp nhận tại quầy"
        description="Nhân viên y tế nhập thông tin và triệu chứng; hệ thống chỉ tạo lộ trình sau khi phòng được xác nhận."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <form onSubmit={(event) => { event.preventDefault(); submitRouting() }} className="card space-y-6">
          <div className="border-b border-border pb-5">
            <h2 className="text-xl font-extrabold">Thông tin bệnh nhân</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <label>
              <span className="field-label">CCCD *</span>
              <input
                value={form.cccd}
                onChange={(event) => update('cccd', event.target.value.replace(/\D/g, '').slice(0, 12))}
                className="form-control"
                placeholder="001204012345"
              />
            </label>
            <label>
              <span className="field-label">Họ và tên *</span>
              <div className="relative">
                <UserRound className="absolute left-3 top-3.5 text-slate-400" size={19} />
                <input
                  value={form.name}
                  onChange={(event) => update('name', event.target.value)}
                  className="form-control pl-10"
                />
              </div>
            </label>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <label>
              <span className="field-label">Tuổi *</span>
              <input
                value={form.age}
                onChange={(event) => update('age', event.target.value.replace(/\D/g, '').slice(0, 3))}
                className="form-control"
              />
            </label>
            <label>
              <span className="field-label">Giới tính</span>
              <select value={form.gender} onChange={(event) => update('gender', event.target.value as IntakeForm['gender'])} className="form-control">
                <option value="UNKNOWN">Chưa xác định</option>
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
                <option value="OTHER">Khác</option>
              </select>
            </label>
            <label>
              <span className="field-label">Thai kỳ</span>
              <select
                disabled={form.gender !== 'FEMALE'}
                value={form.pregnancyStatus}
                onChange={(event) => update('pregnancyStatus', event.target.value as IntakeForm['pregnancyStatus'])}
                className="form-control disabled:bg-slate-100"
              >
                <option value="NA">Không áp dụng</option>
                <option value="NO">Không mang thai</option>
                <option value="YES">Đang mang thai</option>
                <option value="UNKNOWN">Chưa rõ</option>
              </select>
            </label>
          </div>
          <label>
            <span className="field-label">Triệu chứng bệnh nhân mô tả *</span>
            <textarea
              value={form.symptoms}
              onChange={(event) => update('symptoms', event.target.value)}
              className="form-control min-h-40"
              placeholder="Ví dụ: đau tai phải, chảy dịch hai ngày, không sốt..."
            />
          </label>
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="shrink-0" size={19} />
            <p>Trường hợp khó thở nặng, mất ý thức, đau ngực dữ dội hoặc chảy máu nhiều phải chuyển ngay đến Cấp cứu.</p>
          </div>
          <button
            type="submit"
            disabled={routing.isPending}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#126b5b] px-6 font-bold text-white disabled:bg-slate-300"
          >
            {routing.isPending ? <LoaderCircle className="animate-spin" size={19} /> : <Stethoscope size={19} />}
            Phân tích triệu chứng
          </button>
        </form>

        <aside className="space-y-4">
          {result ? (
            <div className="card text-center">
              <CheckCircle2 className="mx-auto text-emerald-700" size={48} />
              <h2 className="mt-3 text-xl font-extrabold">Đã tạo lộ trình thật</h2>
              <p className="mt-3 text-sm text-slate-600">CCCD <strong>{result.patient.cccd}</strong></p>
              <p className="text-sm text-slate-600">Mã lượt <strong>{result.visitId}</strong></p>
              <p className="text-sm text-slate-600">{result.currentRoom} · số <strong>{result.queueNumber}</strong></p>
              <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
                Bệnh nhân đăng nhập bằng CCCD này sẽ thấy ngay lộ trình vừa tạo.
              </p>
            </div>
          ) : recommendation ? (
            <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
              <div className="bg-[#126b5b] p-5 text-white">
                <p className="text-sm text-white/80">Kết quả phân luồng</p>
                <h2 className="text-2xl font-extrabold">Xác nhận phòng</h2>
              </div>
              <div className="p-5">
                <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{recommendation.reason}</p>
                <div className="mt-4 space-y-3">
                  {options.map((item) => (
                    <button
                      type="button"
                      key={item.room}
                      onClick={() => setSelectedRoom(item.room)}
                      className={`w-full rounded-xl border-2 p-4 text-left ${selectedRoom === item.room ? 'border-[#126b5b] bg-emerald-50' : 'border-slate-200'}`}
                    >
                      <strong>{item.room}</strong>
                      <span className="mt-1 block text-sm text-slate-500">
                        {item.department} · {Math.round(item.confidence * 100)}%
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={!selectedRoom || create.isPending}
                  onClick={() => create.mutate()}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#126b5b] px-4 py-3 font-bold text-white disabled:bg-slate-300"
                >
                  <ClipboardPlus />Tạo bệnh nhân và lộ trình thật<ArrowRight size={18} />
                </button>
              </div>
            </div>
          ) : (
            <div className="card grid min-h-80 place-items-center text-center">
              <div>
                <MapPin className="mx-auto text-slate-400" size={44} />
                <h3 className="mt-3 font-bold">Chưa có kết quả phân luồng</h3>
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  )
}
