import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { patientApi } from '../../api/patientApi'
import { EmptyState } from '../../components/common/EmptyState'
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton'
import { PageHeader } from '../../components/common/PageHeader'
import { ResultPredictionCard } from '../../components/patient/ResultPredictionCard'
import { useVisitStore } from '../../stores/visitStore'
export function PatientResultsPage() { const visitId = useVisitStore((s) => s.visitId); const query = useQuery({ queryKey: ['results', visitId], queryFn: () => patientApi.getResults(visitId!), enabled: Boolean(visitId) }); if (!visitId) return <><PageHeader title="Kết quả dịch vụ"/><EmptyState title="Chưa có lượt khám" description="Kết quả sẽ xuất hiện sau khi bạn check-in và thực hiện dịch vụ."/><Link to="/patient/checkin" className="mx-auto mt-5 block w-fit rounded-xl bg-primary px-5 py-3 font-bold text-white">Đi đến check-in</Link></>; return <><PageHeader title="Kết quả dịch vụ" description="Chỉ hiển thị kết luận đã được bác sĩ xác nhận."/>{query.isLoading ? <LoadingSkeleton/> : query.data?.length ? <div className="space-y-4">{query.data.map((result) => <ResultPredictionCard key={result.id} result={result}/>)}</div> : <EmptyState title="Chưa có kết quả" description="Các kết quả cận lâm sàng sẽ xuất hiện tại đây."/>}<div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm text-blue-800">Kết quả chưa được bác sĩ xác nhận sẽ không hiển thị kết luận y khoa.</div></> }
