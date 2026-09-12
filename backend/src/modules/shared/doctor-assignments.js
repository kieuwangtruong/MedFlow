function activeAssignmentFilter({ doctorId, roomId, _now = new Date() } = {}) {
  return {
    ...(doctorId ? { doctorId } : {}),
    ...(roomId ? { roomId } : {}),
    status: 'ACTIVE',
  };
}

function activeRoomFilter(doctorId, _now = new Date()) {
  return {
    OR: [
      {
        doctorAssignments: {
          some: {
            ...(doctorId ? { doctorId } : {}),
            status: 'ACTIVE',
          },
        },
      },
      ...(doctorId ? [{ doctorId }] : []),
    ],
  };
}

function activeDoctorForRoom(room, _now = new Date()) {
  const assignment = room?.doctorAssignments?.find((candidate) => (
    candidate.status === 'ACTIVE'
  ));
  return assignment?.doctor || room?.doctor || null;
}

module.exports = {
  activeAssignmentFilter,
  activeDoctorForRoom,
  activeRoomFilter,
};
