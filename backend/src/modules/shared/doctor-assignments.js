function activeAssignmentFilter({ doctorId, roomId, now = new Date() } = {}) {
  return {
    ...(doctorId ? { doctorId } : {}),
    ...(roomId ? { roomId } : {}),
    status: 'ACTIVE',
    shiftStart: { lte: now },
    shiftEnd: { gt: now },
  };
}

function activeRoomFilter(doctorId, now = new Date()) {
  return {
    doctorAssignments: {
      some: activeAssignmentFilter({ doctorId, now }),
    },
  };
}

function activeDoctorForRoom(room, now = new Date()) {
  const assignment = room?.doctorAssignments?.find((candidate) => (
    candidate.status === 'ACTIVE'
    && new Date(candidate.shiftStart) <= now
    && new Date(candidate.shiftEnd) > now
  ));
  return assignment?.doctor || room?.doctor || null;
}

module.exports = {
  activeAssignmentFilter,
  activeDoctorForRoom,
  activeRoomFilter,
};
