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
            // Supabase セッションをクリア
            const { error } = await supabase.auth.signOut();

            if (error) {
                console.error('Logout error:', error);
                alert('ログアウトに失敗しました。もう一度お試しください。');
                setIsLoading(false);
                return;
            }

            // sessionStorage をクリア
            sessionStorage.removeItem('user_session');

            // ログインページへリダイレクト
            router.push('/login');
        } catch (error) {
            console.error('Logout error:', error);
            alert('ログアウトに失敗しました。もう一度お試しください。');
            setIsLoading(false);
        }
    };

    return (
        <Button
            onClick={handleLogout}
            variant={variant}
            size={size}
            disabled={isLoading}
            className={className}
        >
            {isLoading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ログアウト中...
                </>
            ) : (
                <>
                    {showIcon && <LogOut className="mr-2 h-4 w-4" />}
                    ログアウト
                </>
            )}
        </Button>
    );
}
