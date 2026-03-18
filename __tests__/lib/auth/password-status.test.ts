import { hasCompletedPasswordSetup } from '@/lib/auth/password-status';
import type { User } from '@supabase/supabase-js';

function makeUser(overrides: Partial<User>): User {
  return {
    id: 'test-user-id',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as User;
}

describe('hasCompletedPasswordSetup', () => {
  it('password_set: true のとき true を返す', () => {
    const user = makeUser({ user_metadata: { password_set: true } });
    expect(hasCompletedPasswordSetup(user)).toBe(true);
  });

  it('password_set: false のとき false を返す', () => {
    const user = makeUser({ user_metadata: { password_set: false } });
    expect(hasCompletedPasswordSetup(user)).toBe(false);
  });

  it('user_metadata が空のとき false を返す', () => {
    const user = makeUser({ user_metadata: {} });
    expect(hasCompletedPasswordSetup(user)).toBe(false);
  });

  it('user_metadata が undefined のとき false を返す', () => {
    const user = makeUser({ user_metadata: undefined });
    expect(hasCompletedPasswordSetup(user)).toBe(false);
  });
});
