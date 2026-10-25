// Classe A Barbearia — Cloud Functions (v2, southamerica-east1).
export {
  barberUpdateAppointmentStatus,
  cancelAppointment,
  createAppointment,
  getAvailableSlots,
  rescheduleAppointment,
} from './booking';
export { onBarberDayWrite, onBarberWrite } from './availability';
export { onAppointmentWrite, createBarber, setUserRole } from './staff';
export {
  addPaymentMethod,
  cancelSubscription,
  changePlan,
  confirmMockPix,
  createPixCharge,
  getPixStatus,
  removePaymentMethod,
  setAutoRenew,
  setDefaultPaymentMethod,
  subscribePlan,
} from './payments';
export { acceptLegalVersions, completeProfile, deleteMyAccount, exportMyData, setMarketingConsent } from './account';
export { appointmentReminders, dailySubscriptions } from './scheduled';
