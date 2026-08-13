import type { Room } from '../../types'

export function RoomRecommendationList({
  rooms,
  selected,
  onSelect,
}: {
  rooms: Room[]
  selected?: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="space-y-2">
      {rooms.map((room) => (
        <button
          type="button"
          key={room.id}
          onClick={() => onSelect(room.id)}
          className={`w-full rounded-xl border p-4 text-left ${selected === room.id ? 'border-teal-600 bg-teal-50' : 'border-slate-200'}`}
        >
          <div className="flex justify-between gap-3">
            <strong>{room.name}</strong>
            <span>{room.averageWait} phút</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {room.department} · Tầng {room.floor} · {room.waitingCount} bệnh nhân đang chờ
          </p>
        </button>
      ))}
    </div>
  )
}
