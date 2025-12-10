import { createClient } from '@/utils/supabase/server';

export interface UserSession {
    user_id: string;
    email: string;
    name: string;
    role: 'site_admin' | 'company_admin' | 'facility_admin' | 'staff';
    company_id: string | null;
    company_name: string | null;
    facilities: Array<{
        facility_id: string;
        facility_name: string;
        is_primary: boolean;
    }>;
    current_facility_id: string | null;
    classes: Array<{
        class_id: string;
        class_name: string;
        facility_id: string;
        is_homeroom: boolean;
    }>;
}

export async function getUserSession(userId: string): Promise<UserSession | null> {
    const supabase = await createClient();

    try {
        // 1. Fetch User Basic Info
        const { data: userData, error: userError } = await supabase
            .from('m_users')
            .select(`
        id,
        email,
        name,
        role,
        company_id,
        m_companies (
          name
        )
      `)
            .eq('id', userId)
            .eq('is_active', true)
            .is('deleted_at', null)
            .single();

        if (userError || !userData) {
            console.error('Error fetching user data:', userError);
            return null;
        }

        // 2. Fetch Facilities
        const { data: facilitiesData, error: facilitiesError } = await supabase
            .from('_user_facility')
            .select(`
        is_primary,
        m_facilities (
          id,
          name
        )
      `)
            .eq('user_id', userId);

        if (facilitiesError) {
            console.error('Error fetching facilities:', facilitiesError);
            return null;
        }

        // 3. Fetch Classes
        const { data: classesData, error: classesError } = await supabase
            .from('_user_class')
            .select(`
        is_homeroom,
        m_classes (
          id,
          name,
          facility_id
        )
      `)
            .eq('user_id', userId);

        if (classesError) {
            console.error('Error fetching classes:', classesError);
            return null;
        }

        // Transform Data
        const facilities = facilitiesData.map((item: any) => ({
            facility_id: item.m_facilities.id,
            facility_name: item.m_facilities.name,
            is_primary: item.is_primary,
        })).sort((a, b) => (b.is_primary === a.is_primary ? 0 : b.is_primary ? 1 : -1));

        const classes = classesData.map((item: any) => ({
            class_id: item.m_classes.id,
            class_name: item.m_classes.name,
            facility_id: item.m_classes.facility_id,
            is_homeroom: item.is_homeroom,
        }));

        // Determine Current Facility (Default to primary)
        const primaryFacility = facilities.find(f => f.is_primary);
        const current_facility_id = primaryFacility ? primaryFacility.facility_id : (facilities[0]?.facility_id || null);

        const session: UserSession = {
            user_id: userData.id,
            email: userData.email,
            name: userData.name,
            role: userData.role as UserSession['role'],
            company_id: userData.company_id,
            company_name: userData.m_companies ? (userData.m_companies as any).name : null,
            facilities,
            current_facility_id,
            classes,
        };

        return session;

    } catch (error) {
        console.error('Unexpected error in getUserSession:', error);
        return null;
    }
}
