// Presentation mappers shared by controllers so API responses stay consistent.

export const toDoctorView = (doctor) => ({
  _id: doctor._id,
  userId: doctor.userId?._id || doctor.userId,
  fullName: doctor.userId?.fullName || "Doctor",
  profilePic: doctor.userId?.profilePic || "",
  specialization: doctor.specialization || "",
  qualifications: doctor.qualifications || [],
  experienceYears: doctor.experienceYears || 0,
  consultationFee: doctor.consultationFee || 0,
  clinicAddress: doctor.clinicAddress || "",
  about: doctor.about || "",
  languages: doctor.languages || [],
  availability: doctor.availability || [],
  rating: doctor.rating || 0,
  reviewCount: doctor.reviewCount || 0,
  isVerified: doctor.isVerified || false,
  isAvailable: doctor.isAvailable ?? true,
});

// Appointment populated with patient (User) and doctor (Doctor -> User).
export const toAppointmentView = (a) => {
  const doctor = a.doctorId;
  const patient = a.patientId;
  return {
    _id: a._id,
    date: a.date,
    time: a.time,
    status: a.status,
    reason: a.reason,
    doctorId: doctor?._id || a.doctorId,
    doctorName: doctor?.userId?.fullName || "Doctor",
    doctorProfilePic: doctor?.userId?.profilePic || "",
    specialization: doctor?.specialization || "",
    consultationFee: doctor?.consultationFee || 0,
    patientId: patient?._id || a.patientId,
    patientName: patient?.fullName || "Patient",
    patientProfilePic: patient?.profilePic || "",
    createdAt: a.createdAt,
  };
};