const supabaseState = {
  activityInsert: null as any,
  observationInserts: [] as any[],
  session: { user: { id: 'user-1' } },
  sessionError: null as any,
};

export function resetSupabaseMock() {
  supabaseState.activityInsert = null;
  supabaseState.observationInserts = [];
  supabaseState.session = { user: { id: 'user-1' } };
  supabaseState.sessionError = null;
}

export function setSessionError(error: any) {
  supabaseState.sessionError = error;
}

export function getSupabaseState() {
  return supabaseState;
}

export async function createClient() {
  return {
    auth: {
      getSession: async () => (
        supabaseState.sessionError
          ? { data: { session: null }, error: supabaseState.sessionError }
          : { data: { session: supabaseState.session }, error: null }
      ),
    },
    from(table: string) {
      if (table === 'r_activity') {
        return {
          insert(values: any) {
            supabaseState.activityInsert = values;
            return {
              select() {
                return {
                  single: async () => ({
                    data: {
                      ...values,
                      id: 'activity-1',
                      created_at: '2025-01-01T00:00:00.000Z',
                    },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }

      if (table === 'r_observation') {
        return {
          insert: async (values: any) => {
            supabaseState.observationInserts.push(values);
            return { error: null };
          },
        };
      }

      return {
        select: async () => ({ data: [], error: null, count: 0 }),
        eq: () => this,
        order: () => this,
        range: () => this,
        is: () => this,
      };
    },
  };
}
