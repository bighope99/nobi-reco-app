'use client';

import { useState, useEffect } from 'react';
import { UserSession } from '@/lib/auth/session';
import { createClient } from '@/utils/supabase/client';

export function useSession(): UserSession | null {
    const [session, setSession] = useState<UserSession | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // 1. まず sessionStorage から読む（既存ロジック）
        const stored = localStorage.getItem('user_session');
        if (stored) {
            try {
                setSession(JSON.parse(stored));
                return; // データがあればそのまま使用
            } catch (e) {
                console.error('Failed to parse session data', e);
                localStorage.removeItem('user_session');
            }
        }

        // 2. sessionStorage が空 → Supabase Auth から復旧を試みる
        const restoreSession = async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();

                if (!user) return; // 未ログイン → 何もしない

                const response = await fetch('/api/auth/session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Skip-SessionGuard': '1',
                    },
                    body: JSON.stringify({ user_id: user.id }),
                });

                if (!response.ok) return;

                const sessionData: UserSession = await response.json();
                localStorage.setItem('user_session', JSON.stringify(sessionData));
                setSession(sessionData);
            } catch (e) {
                console.error('Failed to restore session', e);
            }
        };

        restoreSession();
    }, []);

    return session;
}
