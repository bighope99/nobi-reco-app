---
paths:
  - "app/**/*.tsx"
  - "app/**/*.ts"
  - "components/**"
  - "hooks/**"
---
# Frontend Standards

## Role-based UI（IMPORTANT）

NEVER compare `session.role` directly. Always use `useRole()`.

```tsx
const { isAdmin, isFacilityAdmin, isStaff, hasRole } = useRole()
// isAdmin: site_admin または company_admin
// isFacilityAdmin: facility_admin
// isStaff: staff
// hasRole('facility_admin', 'site_admin'): 複数ロール指定
```

ロール→サイドバー変換: `getSidebarType(role)` in `components/layout/app-layout.tsx`
