# Contributing to CentenarianOS

## Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/dapperAuteur/centenarian-os.git`
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Install dependencies: `npm install`
5. Copy `.env.example` to `.env.local` and configure

## Coding Standards

### TypeScript
- **Strict mode enabled** - No `any` types without `eslint-disable` comment
- **Explicit return types** for exported functions
- **Interface over type** for object shapes
- **Named exports** preferred over default exports

```typescript
// ✅ Good
export interface Task {
  id: string;
  title: string;
}

export function createTask(title: string): Task {
  return { id: crypto.randomUUID(), title };
}

// ❌ Avoid
export type Task = { id: string; title: string; };
export default function(title: any) { ... }
```

### React Components
- **Functional components** with TypeScript interfaces for props
- **Descriptive names** (`TaskCard` not `Card`, `useTasks` not `useFetch`)
- **Single responsibility** - max 200 lines per component
- **Prop destructuring** with default values

```typescript
// ✅ Good
interface TaskCardProps {
  task: Task;
  onToggle: (id: string) => void;
  variant?: 'compact' | 'expanded';
}

export function TaskCard({ task, onToggle, variant = 'compact' }: TaskCardProps) {
  // ...
}
```

### File Organization
```
components/
  planner/
    TaskCard.tsx        # Component
    TaskCard.test.tsx   # Tests
    TaskList.tsx
  shared/
    Button.tsx
    
lib/
  hooks/
    useTasks.ts         # Hook
    useTasks.test.ts    # Tests
  types/
    index.ts            # All type exports
```

### Comments & Documentation
- **JSDoc** for all exported functions
- **Inline comments** explain "why", not "what"
- **TODO comments** include issue number: `// TODO(#123): Add pagination`

```typescript
/**
 * Syncs offline queue with Supabase when connection restored
 * @throws {Error} If Supabase operation fails
 */
export async function syncQueue(): Promise<void> {
  // Process oldest operations first to maintain data consistency
  const operations = await db.getAll('queue');
  // ...
}
```

## Git Workflow

### Commits
Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(planner): add milestone grouping by quarter
fix(auth): prevent duplicate signups on slow networks
docs(readme): update installation steps
refactor(hooks): extract shared date logic
test(planner): add task toggle edge cases
```

### Pull Requests

**Before submitting:**
1. Run tests: `npm test`
2. Check types: `npm run type-check`
3. Lint code: `npm run lint`
4. Update docs if needed

**PR Template:**
```markdown
## What
Brief description of changes

## Why
Problem this solves or feature it adds

## How
Implementation approach

## Testing
Steps to verify changes work

## Screenshots (if UI changes)
[Attach images]

Closes #123
```

### Branch Naming
- `feature/add-nutrition-module`
- `fix/task-sorting-bug`
- `docs/update-security-policy`
- `refactor/extract-date-utils`

## Testing Requirements

### Unit Tests
- **Coverage**: 80%+ for new business logic
- **File location**: Next to source file (`useTasks.test.ts`)
- **Framework**: Jest + React Testing Library

```typescript
// useTasks.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useTasks } from './useTasks';

describe('useTasks', () => {
  it('fetches tasks for date range', async () => {
    const { result } = renderHook(() => useTasks('2025-01-01', '2025-01-07'));
    
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tasks).toHaveLength(5);
  });
});
```

### E2E Tests
- **Critical user flows** (signup, create task, toggle completion)
- **Framework**: Playwright
- **Location**: `e2e/` directory

## Database Changes

### Migrations
1. Create migration file: `supabase/migrations/003_add_nutrition_table.sql`
2. Use timestamp prefix: `YYYYMMDDHHMMSS_description.sql`
3. Include rollback instructions in comments
4. Test locally before pushing

```sql
-- Migration: Add nutrition tracking
-- Rollback: DROP TABLE meals; DROP TABLE ingredients;

CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  -- ...
);

-- Add RLS policies
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ingredients"
  ON ingredients FOR SELECT
  USING (auth.uid() = user_id);
```

## Security Requirements

**Never commit:**
- API keys or secrets (use `.env.local`)
- User data or PII
- Database credentials
- Session tokens

**Always:**
- Validate user input (use Zod schemas)
- Use parameterized queries (Supabase handles this)
- Enable RLS on new tables
- Add CSRF protection for mutations
- Test auth flows in incognito mode

## Code Review Checklist

Reviewers should verify:
- [ ] Tests pass (`npm test`)
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] Follows coding standards (linter passes)
- [ ] Security best practices followed
- [ ] Documentation updated (if needed)
- [ ] No breaking changes (or properly versioned)
- [ ] Accessible (keyboard nav, ARIA labels if needed)
- [ ] Mobile responsive (if UI changes)

## Questions?

- **Bug reports**: [GitHub Issues](https://github.com/dapperAuteur/centenarian-os/issues)
- **Feature requests**: [Discussions](https://github.com/dapperAuteur/centenarian-os/discussions)
- **Security issues**: [security@awews.com](mailto:security@awews.com)

## Recognition

Contributors are listed in [README.md](./README.md) and release notes.

Thank you for contributing! 🎉