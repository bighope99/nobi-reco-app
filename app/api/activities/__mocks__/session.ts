let currentSession: any = {
  current_facility_id: 'facility-1',
  user_id: 'user-1',
};

export function setUserSession(session: any) {
  currentSession = session;
}

export function resetUserSession() {
  currentSession = {
    current_facility_id: 'facility-1',
    user_id: 'user-1',
  };
}

export async function getUserSession() {
  return currentSession;
}
