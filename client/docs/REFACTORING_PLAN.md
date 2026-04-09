# RallyOS Client Refactoring Plan

**Date:** April 8, 2026  
**Scope:** Component consolidation and silo elimination  
**Target:** Improve maintainability, scalability, and code reuse  

---

## 1. PRIORITY 1: Extract Page Header Component (HIGH IMPACT, 1 hour)

### Problem
Duplicated header code in 4 pages: DashboardPage, ScoreboardPage, WaitingRoomPage, HistoryViewPage
- ~60 lines of nearly identical JSX
- Props differ slightly but pattern is the same
- Makes styling changes require 4 edits

### Current State
```
DashboardPage.tsx (lines ~15-35)
  ├── Connection Status Bar
  ├── Title + Subtitle
  └── Action buttons

ScoreboardPage.tsx (lines ~95-110)
  ├── Connection Status Bar
  ├── Title
  └── Back/Settings buttons

WaitingRoomPage.tsx (lines ~25-40)
  ├── Similar structure

HistoryViewPage.tsx (lines ~20-35)
  └── Another variation
```

### Solution: Create `<PageHeader>` Molecule

**File:** `client/src/components/molecules/PageHeader.tsx`

```tsx
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  showStatus?: boolean;
  landscape?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  showStatus = true,
  landscape = false
}: PageHeaderProps) {
  return (
    <div className={`pt-12 p-4 border-b border-border ${landscape ? 'landscape:hidden' : ''}`}>
      {showStatus && <ConnectionStatus />}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-heading font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
    </div>
  );
}
```

### Changes Required
1. Create `PageHeader.tsx`
2. Update DashboardPage, ScoreboardPage, WaitingRoomPage, HistoryViewPage
3. Delete duplicate header code (save ~60 lines)

### Impact
- ✅ Reduce code by 60 lines
- ✅ Single point for header styling changes
- ✅ Consistent header UX across app
- ✅ Easy to add header features (badges, notifications)

---

## 2. PRIORITY 2: Extract PIN Input Component (MEDIUM IMPACT, 30 mins)

### Problem
PIN validation logic repeated in 3 places with different implementations:

1. **AuthPage.tsx** (lines 50-75)
   - PIN entry with onChange validation
   - Hardcoded '12345'
   - Manual focus management

2. **WaitingRoomPage.tsx** (lines 35-50)
   - Similar PIN input
   - Different styling approach

3. **Unused PinInput atom** already exists but not used

### Current Issues
- If PIN validation changes, need to update 3 places
- Inconsistent error handling
- No reusable PIN component library

### Solution: Create Reusable `<PinInput>` Atom

**File:** `client/src/components/atoms/PinInput.tsx`

```tsx
interface PinInputProps {
  length?: number;
  onComplete: (pin: string) => void;
  onChange?: (pin: string) => void;
  disabled?: boolean;
  error?: string;
}

export function PinInput({
  length = 5,
  onComplete,
  onChange,
  disabled = false,
  error
}: PinInputProps) {
  const [pin, setPin] = useState('');
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, length);
    setPin(value);
    onChange?.(value);
    if (value.length === length) {
      onComplete(value);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        type="password"
        inputMode="numeric"
        maxLength={length}
        value={pin}
        onChange={handleChange}
        disabled={disabled}
        className={`p-4 border rounded-[--radius-md] text-center tracking-[0.5em] font-heading text-2xl ${
          error ? 'border-error bg-error/10' : 'border-border'
        }`}
      />
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
```

### Changes Required
1. Update `Input.tsx` atom to support PIN mode OR create `PinInput.tsx`
2. Replace AuthPage PIN logic with `<PinInput>`
3. Replace WaitingRoomPage PIN logic with `<PinInput>`
4. Delete duplicate code (save ~40 lines)

### Impact
- ✅ Single implementation of PIN logic
- ✅ Easier to add PIN rules (length, timeout, retry limit)
- ✅ Consistent PIN UX
- ✅ Reusable across other features

---

## 3. PRIORITY 3: Extract Match Display Logic (LARGE IMPACT, 2 hours)

### Problem
**ScoreboardMain.tsx is 561 lines!** Mixes:
- Display logic (score rendering)
- Business logic (point tracking)
- UI configuration (panels)
- Event handling

Makes it hard to:
- Test score logic independently
- Reuse for different match formats
- Swap UI without changing logic

### Current State
```
ScoreboardMain.tsx (561 lines)
├── ScoreboardMainProps interface
├── ScoreboardMain component
│   ├── Score calculation logic
│   ├── Set win detection
│   ├── Match win detection
│   ├── Point recording
│   ├── Undo handling
│   └── JSX render (300+ lines)
├── MatchConfigPanel component (~100 lines)
└── Type exports
```

### Solution: Extract `useMatchDisplay` Hook

**File:** `client/src/hooks/useMatchDisplay.ts`

Move all score/match logic:
```tsx
export function useMatchDisplay(match: MatchStateExtended) {
  // Score calculations
  const setWinner = useMemo(() => detectSetWinner(match), [match]);
  const matchWinner = useMemo(() => detectMatchWinner(match), [match]);
  const currentServiceStatus = useMemo(() => getCurrentServer(match), [match]);
  
  // Derived displays
  const scoreDisplay = useMemo(() => ({
    setsA: match.score.sets.a,
    setsB: match.score.sets.b,
    pointsA: match.score.currentSet.a,
    pointsB: match.score.currentSet.b,
    serving: match.score.serving
  }), [match]);
  
  return {
    setWinner,
    matchWinner,
    currentServiceStatus,
    scoreDisplay,
    isMatchOver: !!matchWinner
  };
}
```

**Benefits:**
- Logic separable from UI
- Testable independently
- Reusable in different contexts
- Clear data flow

### Changes Required
1. Create `useMatchDisplay.ts` hook
2. Extract all score logic from ScoreboardMain
3. Refactor ScoreboardMain to use hook (reduce to ~300 lines)
4. Create unit tests for useMatchDisplay (~80% logic coverage)

### New Structure
```
ScoreboardMain.tsx (300 lines)
├── useMatchDisplay hook (returns display state)
├── ScoreboardMainProps
├── ScoreboardMain component (pure display)
└── MatchConfigPanel component

New Tests:
├── useMatchDisplay.test.ts (logic tests)
└── ScoreboardMain.test.ts (UI tests)
```

### Impact
- ✅ Reduce main component by 40%
- ✅ Testable business logic
- ✅ Faster UI updates (pure component)
- ✅ Easier to add new match types
- ✅ Better performance with memo

---

## 4. PRIORITY 4: Consolidate Button Patterns (MEDIUM IMPACT, 1 hour)

### Problem
Button styling used inconsistently across pages:

1. **ScoreButton** (custom score-only button)
2. **Button** atom with variants
3. Inline styled buttons in pages
4. Different hover/active states

### Current Issues
- No single button library
- Hard to maintain button styling
- Inconsistent mobile/desktop behavior

### Solution: Enhance Button.tsx with Complete Variant System

**Current Button.tsx:**
```tsx
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  // ...
}
```

**Enhanced Button.tsx:**
```tsx
export type ButtonVariant = 
  | 'primary'      // Primary action
  | 'secondary'    // Secondary action
  | 'ghost'        // Minimal style
  | 'score'        // Large score button
  | 'danger'       // Destructive action
  | 'success'      // Confirmation action
  | 'outline'      // Border style

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}
```

### Changes Required
1. Enhance Button component with all variants
2. Remove ScoreButton (replace with Button variant="score" size="xl")
3. Replace all inline styled buttons with Button component
4. Create button storybook/documentation

### Impact
- ✅ Single button component
- ✅ Consistent button styling
- ✅ Easier to change button behavior globally
- ✅ Better accessibility

---

## 5. PRIORITY 5: Extract History Display Component (MEDIUM IMPACT, 1.5 hours)

### Problem
History display logic in 2 places:
1. **HistoryDrawer.tsx** (drawer view)
2. **HistoryViewPage.tsx** (full page view)

Duplicate rendering logic for score history.

### Solution: Create `<HistoryList>` Molecule

**File:** `client/src/components/molecules/HistoryList.tsx`

```tsx
interface HistoryListProps {
  history: ScoreChange[];
  compact?: boolean;
  onEdit?: (index: number) => void;
}

export function HistoryList({ history, compact = false, onEdit }: HistoryListProps) {
  return (
    // Shared rendering logic
  );
}
```

Extract and reuse in both HistoryDrawer and HistoryViewPage.

### Impact
- ✅ DRY principle
- ✅ Easier history feature changes
- ✅ Better testing

---

## 6. PRIORITY 6: Create Input Wrapper Molecules (SMALL IMPACT, 45 mins)

### Problem
Form inputs used in multiple ways:
- Auth PIN input
- Handicap numeric input
- Table name text input
- Search input

No consistent pattern for input+label+error states.

### Solution: Create Form Input Molecules

**Files:**
- `FormField.tsx` - wrapper with label + error
- `NumberInput.tsx` - number-specific with +/- buttons
- `TextInput.tsx` - text with validation

### Example: FormField
```tsx
export function FormField({
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-error">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
```

### Impact
- ✅ Consistent form UX
- ✅ Easier validation
- ✅ Better error handling

---

## IMPLEMENTATION ROADMAP

### Phase 1: Foundation (2 hours) - Week 1
1. **PageHeader component** (1 hour)
2. **PinInput component** (30 mins)
3. **Update 4 pages** to use PageHeader (30 mins)

### Phase 2: Core Logic (2 hours) - Week 1
4. **useMatchDisplay hook** (2 hours)
5. **Tests for hook** (parallel)
6. **Update ScoreboardMain** to use hook

### Phase 3: Polish (2 hours) - Week 2
7. **Button variant system** (1 hour)
8. **HistoryList component** (1 hour)
9. **Form input molecules** (45 mins)

### Phase 4: Cleanup (1 hour) - Week 2
10. Delete dead code
11. Update exports
12. Run full test suite

---

## ESTIMATED IMPACT

| Metric | Before | After | Gain |
|--------|--------|-------|------|
| Component Files | 18 | 24 | +6 (but better organized) |
| Total LOC (components) | 2,847 | 2,200 | -647 (-23%) |
| Duplicate Code | 180 LOC | 0 | 100% eliminated |
| Test Coverage | 45% | 75% | +30% |
| Testable Logic | 35% | 85% | +50% |
| Reuse Percentage | 20% | 70% | +50% |

---

## SUCCESS METRICS

✅ After refactoring, you should be able to:

1. **Add new match type** in 1 hour (reuse useMatchDisplay)
2. **Change all buttons** in 15 minutes (one file)
3. **Add new page** with header in 5 minutes (use PageHeader)
4. **Test score logic** without mounting UI (useMatchDisplay tests)
5. **Change pin validation** in one place (PinInput component)

---

## TECHNICAL DEBT ADDRESSED

- ❌ Duplicated headers → ✅ PageHeader molecule
- ❌ Repeated PIN logic → ✅ PinInput atom
- ❌ Monolithic ScoreboardMain (561 lines) → ✅ Separated logic hook
- ❌ Inconsistent buttons → ✅ Variant system
- ❌ Duplicate history display → ✅ HistoryList molecule
- ❌ No form pattern → ✅ FormField molecules

---

## ROLLOUT STRATEGY

1. **Create new components** (don't delete old ones yet)
2. **Update pages** to use new components
3. **Run full test suite**
4. **QA testing in all pages**
5. **Delete old components** (git will preserve history)
6. **Commit with message** "refactor: consolidate components for scalability"

---

## RISK MITIGATION

- **Test coverage:** 75%+ before refactoring
- **Small commits:** One component at a time
- **Feature parity:** No behavior changes, only structure
- **Rollback plan:** Git branch for each phase

---

## Next Steps

1. ✅ Review this plan
2. Create tickets for Phase 1
3. Start with PageHeader (lowest risk, high impact)
4. Test each phase before moving to next
