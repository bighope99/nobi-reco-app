'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

    const handleLogout = async () => {
        setIsLoading(true);

        try {
            // 1. sessionStorage を先にクリア（リダイレクト前に確実に削除）
            sessionStorage.removeItem('user_session');

            // 2. サーバー側でセッションとCookieをクリア（signOutもサーバーで実行）
            const response = await fetch('/api/auth/logout', { method: 'POST' });
            if (!response.ok) {
                console.warn('Logout API returned non-OK status');
            }

            // 3. ログインページへリダイレクト
            router.push('/login');
        } catch (error) {
            console.error('Logout error:', error);
            // エラーでもリダイレクト
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
