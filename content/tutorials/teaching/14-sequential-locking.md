# Lesson 14: Sequential Module Locking

**Course:** The Teaching Dashboard
**Module:** Course Settings
**Duration:** ~4 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

By default, students can access any lesson in any order (especially with CYOA navigation). But some courses need students to complete modules in sequence — Module 1 before Module 2, Module 2 before Module 3. Sequential module locking gives you that control.

---

### What Sequential Locking Does

When you enable sequential locking on a course, students must complete all non-free-preview lessons in a module before accessing lessons in the next module.

If a student tries to open a lesson in Module 3 but hasn't finished Module 2, they see a locked state with a message explaining which module they need to complete first.

Free preview lessons are excluded from the lock — they're always accessible regardless of progress.

---

### Enabling Sequential Locking

1. Navigate to your course editor
2. Open the course settings
3. Toggle **Sequential Modules** to ON (the `is_sequential` field)
4. Save

That's it. The system automatically enforces the module order based on your module structure.

---

### How the Lock Is Checked

When a student opens a lesson, the system checks:

1. Is `is_sequential` true on the course?
2. Is this lesson inside Module N (where N > 1)?
3. Has the student completed all non-free-preview lessons in Modules 1 through N-1?

If any prior module has incomplete lessons, the student sees:
```
{ locked: true, module_locked: true }
```

The lesson page shows a lock icon and a message like "Complete Module 2 to unlock this lesson."

---

### Sequential Locking vs. CYOA

These are separate settings and can coexist:

| Setting | What It Controls |
|---------|-----------------|
| **Navigation Mode: CYOA** | After completing a lesson, students choose their next lesson from crossroads options |
| **Sequential Modules: ON** | Students must complete all lessons in Module N before Module N+1 unlocks |

**CYOA + Sequential** means: students can explore lessons freely within a module (CYOA), but the next module doesn't unlock until the current one is fully complete.

**Linear + Sequential** means: strict lesson-by-lesson progression within each module, and module-by-module progression across the course.

**CYOA without Sequential** means: students can jump to any lesson in any module at any time. This is the default for tutorial courses.

---

### When to Use Sequential Locking

**Use it when:**
- Later modules build directly on earlier material (e.g., math: algebra before calculus)
- You need students to complete prerequisite assignments before advancing
- The course has a certification or grading component that requires ordered completion

**Skip it when:**
- The course is a reference guide (like tutorial courses)
- Modules are independent topics that don't depend on each other
- You want students to self-direct their learning path

---

### Module Order

Sequential locking uses the module `order` field to determine the sequence. Module order 1 is first, order 2 is second, etc.

If you reorder modules in the course editor, the lock sequence updates accordingly. Make sure your module order matches your intended prerequisite chain.

---

## Screen Recording Notes

> [SCREEN: Navigate to the course editor — open course settings]

> [SCREENSHOT: Course settings — callout: "Sequential Modules" toggle (OFF by default)]

> [SCREEN: Toggle Sequential Modules ON — save]

> [SCREEN: Log in as a student — navigate to the course]

> [SCREEN: Try to open a lesson in Module 2 without completing Module 1]

> [SCREENSHOT: Locked lesson state — callout: Lock icon + "Complete Module 1 to unlock this lesson"]

> [SCREEN: Go back — complete all Module 1 lessons — return to Module 2]

> [SCREEN: Show Module 2 lessons are now accessible]

---

## Key Takeaways

- Sequential Modules: enable in course settings to enforce module-order progression
- Students must complete all non-free-preview lessons in Module N before Module N+1 unlocks
- Free preview lessons are never locked
- Can combine with CYOA (free exploration within a module, locked between modules) or Linear (strict order everywhere)
- Use for prerequisite-dependent content; skip for reference guides and self-directed courses
