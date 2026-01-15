'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { LogOut, Loader2 } from 'lucide-react';

interface LogoutButtonProps {
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    className?: string;
    showIcon?: boolean;
}

export function LogoutButton({
    variant = 'destructive',
    size = 'default',
    className,
    showIcon = true
}: LogoutButtonProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const supabase = createClient();

    const handleLogout = async () => {
        setIsLoading(true);
        try {
            // 1. まずサーバー側のセッションをクリア（API呼び出し）
            const response = await fetch('/api/auth/logout', { method: 'POST' });
            if (!response.ok) {
                throw new Error('Logout API failed');
            }

            // 2. クライアント側の Supabase セッションをクリア
            await supabase.auth.signOut();

            // 3. sessionStorage をクリア
            sessionStorage.removeItem('user_session');

            // 4. ログインページへリダイレクト
            router.push('/login');
        } catch (error) {
            console.error('Logout error:', error);
            // エラーでも sessionStorage はクリアしてリダイレクト
            sessionStorage.removeItem('user_session');
            router.push('/login');
        } finally {
            setIsLoading(false);
        }
    };

    const isIconOnly = size === 'icon';

    return (
        <Button
            onClick={handleLogout}
            variant={variant}
            size={size}
            disabled={isLoading}
            className={className}
            aria-label={isIconOnly ? "ログアウト" : undefined}
        >
            {isLoading ? (
                isIconOnly ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ログアウト中...
                    </>
                )
            ) : (
                isIconOnly ? (
                    <LogOut className="h-4 w-4" />
                ) : (
                    <>
                        {showIcon && <LogOut className="mr-2 h-4 w-4" />}
                        ログアウト
                    </>
                )
            )}
        </Button>
    );
}
