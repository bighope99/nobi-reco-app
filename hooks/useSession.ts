'use client';

import { useState, useEffect } from 'react';
import { UserSession } from '@/lib/auth/session';

export function useSession(): UserSession | null {
    const [session, setSession] = useState<UserSession | null>(null);

    useEffect(() => {
        // クライアントサイドでのみ実行
        if (typeof window !== 'undefined') {
            const stored = sessionStorage.getItem('user_session');
            if (stored) {
                try {
                    setSession(JSON.parse(stored));
                } catch (e) {
                    console.error('Failed to parse session data', e);
                    sessionStorage.removeItem('user_session');
                }
            }
        }
    }, []);

    return session;
}
