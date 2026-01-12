'use client';

import { forwardRef, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';

interface MentionTextareaProps extends React.ComponentProps<typeof Textarea> {
  mentionPattern?: RegExp;
}

export const MentionTextarea = forwardRef<HTMLTextAreaElement, MentionTextareaProps>(
  // 日本語の姓名（スペース1つを含む）に対応: @姓 名 形式
  ({ mentionPattern = /@[^\s@、。,.!?]+(?:\s[^\s@、。,.!?]+)?/, onKeyDown, onChange, ...props }, ref) => {

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Backspace') {
        const textarea = e.target as HTMLTextAreaElement;
        const cursorPos = textarea.selectionStart;
        const selectionEnd = textarea.selectionEnd;

        // テキスト選択中は通常動作
        if (cursorPos !== selectionEnd) {
          onKeyDown?.(e);
          return;
        }

        const text = textarea.value;
        const beforeCursor = text.slice(0, cursorPos);

        // カーソル直前がメンション末尾かチェック
        const match = beforeCursor.match(new RegExp(mentionPattern.source + '$'));

        if (match) {
          e.preventDefault();
          const mentionStart = cursorPos - match[0].length;
          const newText = text.slice(0, mentionStart) + text.slice(cursorPos);

          // 親コンポーネントに通知
          const syntheticEvent = {
            target: { value: newText },
            currentTarget: { value: newText },
          } as React.ChangeEvent<HTMLTextAreaElement>;

          onChange?.(syntheticEvent);

          // カーソル位置を更新
          requestAnimationFrame(() => {
            textarea.setSelectionRange(mentionStart, mentionStart);
          });
        }
      }

      onKeyDown?.(e);
    }, [onKeyDown, onChange, mentionPattern]);

    return (
      <Textarea
        ref={ref}
        onKeyDown={handleKeyDown}
        onChange={onChange}
        {...props}
      />
    );
  }
);

MentionTextarea.displayName = 'MentionTextarea';
