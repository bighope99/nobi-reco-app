'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export function LogoutButton() {
    const router = useRouter();
    const supabase = createClient();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        sessionStorage.removeItem('user_session');
        router.push('/login');
    };

    return (
        <button
            onClick={handleLogout}
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
        >
            ログアウト
        </button>
    );
}
