# RallyOS Client - Component Structure & Testing Plan

**Updated:** April 8, 2026  
**Scope:** Folder-based component organization with collocated tests

---

## NEW FOLDER STRUCTURE

### Before (Current)
```
client/src/
├── components/
│   ├── atoms/
│   │   ├── Button.tsx
│   │   ├── PinInput.tsx
│   │   ├── Button.test.tsx      ← Separated
│   │   └── ...
│   ├── molecules/
│   │   ├── PageHeader.tsx
│   │   ├── PageHeader.test.tsx  ← Separated
│   │   └── ...
│   └── organisms/
│       ├── ScoreboardMain.tsx
│       └── ...
```

### After (Proposed) ✨
```
client/src/
├── components/
│   ├── atoms/
│   │   ├── Button/
│   │   │   ├── Button.tsx           # Component definition
│   │   │   ├── Button.test.tsx      # Unit tests
│   │   │   ├── Button.types.ts      # TypeScript interfaces
│   │   │   ├── Button.variants.ts   # Variants/constants
│   │   │   └── useButton.ts         # Custom hook (if needed)
│   │   ├── PinInput/
│   │   │   ├── PinInput.tsx
│   │   │   ├── PinInput.test.tsx
│   │   │   ├── PinInput.types.ts
│   │   │   └── PinInput.utils.ts    # Validation logic
│   │   ├── (repeat for all 9 atoms)
│   │   └── index.ts                 # ← BARREL EXPORT
│   │
│   ├── molecules/
│   │   ├── PageHeader/
│   │   │   ├── PageHeader.tsx
│   │   │   ├── PageHeader.test.tsx
│   │   │   ├── PageHeader.types.ts
│   │   │   ├── PageHeader.stories.tsx  # Optional: Storybook
│   │   │   └── PageHeader.module.css   # Optional: Scoped styles
│   │   ├── HistoryList/
│   │   │   ├── HistoryList.tsx
│   │   │   ├── HistoryList.test.tsx
│   │   │   ├── HistoryList.types.ts
│   │   │   ├── HistoryListItem.tsx  # Sub-component
│   │   │   └── HistoryListItem.test.tsx
│   │   ├── (repeat for all 7 molecules)
│   │   └── index.ts                 # ← BARREL EXPORT
│   │
│   ├── organisms/
│   │   ├── ScoreboardMain/
│   │   │   ├── ScoreboardMain.tsx
│   │   │   ├── ScoreboardMain.test.tsx
│   │   │   ├── ScoreboardMain.types.ts
│   │   │   ├── ScoreboardMain.constants.ts
│   │   │   ├── ScoreboardMainHeader.tsx
│   │   │   ├── ScoreboardMainScore.tsx
│   │   │   ├── ScoreboardMainControls.tsx
│   │   │   ├── (and their tests)
│   │   │   └── useScoreboardState.ts    # Complex hook
│   │   ├── DashboardGrid/
│   │   │   ├── DashboardGrid.tsx
│   │   │   ├── DashboardGrid.test.tsx
│   │   │   ├── DashboardGrid.types.ts
│   │   │   ├── DashboardGridCard.tsx
│   │   │   ├── DashboardGridCard.test.tsx
│   │   │   └── DashboardGrid.utils.ts
│   │   ├── (repeat for all 3 organisms)
│   │   └── index.ts                 # ← BARREL EXPORT
│   │
│   ├── shared/
│   │   ├── index.ts                 # Export ConnectionStatus, PrivateRoute
│   │   └── [existing utilities]
│   │
│   └── index.ts                     # ← MAIN BARREL (optional)
│
├── pages/
│   ├── AuthPage/
│   │   ├── AuthPage.tsx
│   │   ├── AuthPage.test.tsx
│   │   ├── AuthPage.types.ts
│   │   ├── AuthPageForm.tsx         # Sub-component
│   │   └── AuthPageForm.test.tsx
│   ├── DashboardPage/
│   │   ├── DashboardPage.tsx
│   │   ├── DashboardPage.test.tsx
│   │   ├── DashboardPage.types.ts
│   │   ├── DashboardPage.constants.ts
│   │   ├── DashboardPageHeader.tsx
│   │   └── DashboardPageContent.tsx
│   ├── (repeat for all 5 pages)
│   ├── index.ts                     # ← BARREL EXPORT
│   └── types.ts                     # Shared page types
│
├── hooks/
│   ├── useMatchDisplay/
│   │   ├── useMatchDisplay.ts
│   │   ├── useMatchDisplay.test.ts
│   │   ├── useMatchDisplay.types.ts
│   │   └── useMatchDisplay.constants.ts
│   ├── (future custom hooks)
│   └── index.ts                     # ← BARREL EXPORT
│
├── __tests__/
│   ├── setup.ts
│   ├── mocks/
│   │   ├── socket.ts
│   │   ├── auth.ts
│   │   └── index.ts
│   └── utils/
│       └── test-utils.tsx
│
└── index.ts                         # Root export

```

---

## FILE RESPONSIBILITIES

### Component File (`Button.tsx`)
```typescript
// ✅ Only the component definition
// ✅ Imports from .types.ts for interfaces
// ✅ Imports constants from .variants.ts
// ❌ No tests
// ❌ No type definitions
// ❌ No constants/variants

import { ButtonProps, ButtonVariant } from './Button.types'
import { variantStyles, sizeStyles } from './Button.variants'

export function Button({ variant = 'primary', size = 'md', ...props }: ButtonProps) {
  // Component code
}
```

### Types File (`Button.types.ts`)
```typescript
// ✅ All TypeScript interfaces/types
// ✅ React prop types that component uses
// ❌ No implementation
// ❌ No tests

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline' | 'score' | 'live'

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: React.ReactNode
  fullWidth?: boolean
}
```

### Variants/Constants File (`Button.variants.ts`)
```typescript
// ✅ All hardcoded values, colors, styles
// ✅ Configuration constants
// ❌ No component code
// ❌ No logic

import { ButtonVariant, ButtonSize } from './Button.types'

export const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-gradient-primary text-white shadow-md hover:shadow-lg',
  secondary: 'bg-surface-low text-text hover:bg-surface-high',
  // ... rest
}

export const sizeStyles: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-xs rounded-[--radius-sm]',
  sm: 'px-3 py-1.5 text-sm rounded-[--radius-sm]',
  // ... rest
}
```

### Test File (`Button.test.tsx`)
```typescript
// ✅ All unit tests and integration tests
// ✅ Imports from Button.tsx
// ✅ Tests each variant
// ❌ No component implementation
// ❌ No duplicate type definitions

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  it('renders with primary variant by default', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })
  // ... more tests
})
```

### Utils File (if needed) (`Button.utils.ts`)
```typescript
// ✅ Pure utility functions
// ✅ Business logic extracted from component
// ❌ No React components
// ❌ No styling

export function getButtonAriaLabel(variant: ButtonVariant, loading?: boolean): string {
  if (loading) return 'Loading'
  return `${variant} button`
}
```

### Sub-component File (`ButtonGroup.tsx`)
```typescript
// ✅ Named within the same folder
// ✅ Has its own .test.tsx
// ✅ Uses parent folder's types if applicable
// ✅ Exports from parent index.ts

import { Button } from './Button'

export function ButtonGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2">{children}</div>
}
```

---

## BARREL EXPORTS (index.ts)

### Atoms Index (`atoms/index.ts`)
```typescript
// Export all atoms with their types
export { Button } from './Button/Button'
export type { ButtonProps, ButtonVariant } from './Button/Button.types'

export { PinInput } from './PinInput/PinInput'
export type { PinInputProps } from './PinInput/PinInput.types'

export { TextInput } from './TextInput/TextInput'
export type { TextInputProps } from './TextInput/TextInput.types'

export { NumberInput } from './NumberInput/NumberInput'
export type { NumberInputProps } from './NumberInput/NumberInput.types'

export { Badge } from './Badge/Badge'
export type { BadgeProps } from './Badge/Badge.types'

export { Icon } from './Icon/Icon'
export type { IconProps } from './Icon/Icon.types'

export { Typography } from './Typography/Typography'
export type { TypographyProps } from './Typography/Typography.types'

export { Input } from './Input/Input'
export type { InputProps } from './Input/Input.types'

export { ConnectionStatus } from './ConnectionStatus/ConnectionStatus'
```

### Molecules Index (`molecules/index.ts`)
```typescript
export { PageHeader } from './PageHeader/PageHeader'
export type { PageHeaderProps } from './PageHeader/PageHeader.types'

export { FormField } from './FormField/FormField'
export type { FormFieldProps } from './FormField/FormField.types'

export { ScoreDisplay } from './ScoreDisplay/ScoreDisplay'
export type { ScoreDisplayProps } from './ScoreDisplay/ScoreDisplay.types'

export { StatCard } from './StatCard/StatCard'
export type { StatCardProps } from './StatCard/StatCard.types'

export { TableStatusChip } from './TableStatusChip/TableStatusChip'
export type { TableStatusChipProps } from './TableStatusChip/TableStatusChip.types'

export { HistoryList } from './HistoryList/HistoryList'
export type { HistoryListProps } from './HistoryList/HistoryList.types'

export { MatchContext } from './MatchContext/MatchContext'
```

### Organisms Index (`organisms/index.ts`)
```typescript
export { ScoreboardMain } from './ScoreboardMain/ScoreboardMain'
export { MatchConfigPanel } from './ScoreboardMain/MatchConfigPanel'
export type { ScoreboardMainProps } from './ScoreboardMain/ScoreboardMain.types'

export { DashboardGrid } from './DashboardGrid/DashboardGrid'
export { DashboardGridHeader } from './DashboardGrid/DashboardGridHeader'
export type { DashboardGridProps } from './DashboardGrid/DashboardGrid.types'

export { HistoryDrawer } from './HistoryDrawer/HistoryDrawer'
export type { HistoryDrawerProps } from './HistoryDrawer/HistoryDrawer.types'
```

### Pages Index (`pages/index.ts`)
```typescript
export { AuthPage } from './AuthPage/AuthPage'
export { DashboardPage } from './DashboardPage/DashboardPage'
export { ScoreboardPage } from './ScoreboardPage/ScoreboardPage'
export { WaitingRoomPage } from './WaitingRoomPage/WaitingRoomPage'
export { HistoryViewPage } from './HistoryViewPage/HistoryViewPage'
```

### Hooks Index (`hooks/index.ts`)
```typescript
export { useMatchDisplay } from './useMatchDisplay/useMatchDisplay'
export type { MatchDisplayState } from './useMatchDisplay/useMatchDisplay.types'
```

---

## USAGE EXAMPLES

### Before (without barrel exports)
```typescript
// src/pages/DashboardPage.tsx
import { Button } from '../components/atoms/Button'
import { PageHeader } from '../components/molecules/PageHeader'
import { DashboardGrid } from '../components/organisms/DashboardGrid'
import type { ButtonProps } from '../components/atoms/Button'
```

### After (with barrel exports)
```typescript
// src/pages/DashboardPage.tsx
import { Button, PageHeader, DashboardGrid } from '@/components'
import type { ButtonProps } from '@/components'

// OR more explicitly:
import { Button } from '@/components/atoms'
import { PageHeader } from '@/components/molecules'
import { DashboardGrid } from '@/components/organisms'
```

---

## FOLDER STRUCTURE DETAILS BY COMPONENT TYPE

### ATOMS FOLDER STRUCTURE
```
atoms/
├── Button/
│   ├── Button.tsx                 # Main component
│   ├── Button.types.ts            # Props interface
│   ├── Button.variants.ts         # Style variants & constants
│   ├── Button.test.tsx            # Unit tests (90%+ coverage)
│   └── Button.stories.tsx         # Optional: Storybook
│
├── PinInput/
│   ├── PinInput.tsx
│   ├── PinInput.types.ts
│   ├── PinInput.test.tsx
│   ├── PinInput.utils.ts          # Validation logic
│   └── PinInput.constants.ts      # Defaults
│
├── (7 more atoms - same pattern)
│
└── index.ts                       # Barrel export

Total: 9 atom folders
Files per atom: 3-5 (tsx, types, test, utils/constants, stories)
```

### MOLECULES FOLDER STRUCTURE
```
molecules/
├── PageHeader/
│   ├── PageHeader.tsx
│   ├── PageHeader.types.ts
│   ├── PageHeader.test.tsx
│   └── PageHeader.styles.ts       # Optional: styled-components or CSS-in-JS
│
├── HistoryList/
│   ├── HistoryList.tsx            # Main component
│   ├── HistoryList.types.ts
│   ├── HistoryList.test.tsx
│   ├── HistoryListItem.tsx        # Sub-component
│   ├── HistoryListItem.types.ts
│   ├── HistoryListItem.test.tsx
│   ├── HistoryList.utils.ts       # Formatting helpers
│   └── HistoryList.constants.ts
│
├── (5 more molecules - same pattern)
│
└── index.ts                       # Barrel export

Total: 7 molecule folders
Files per molecule: 4-7 (main + types + test + sub-components + utils/constants)
```

### ORGANISMS FOLDER STRUCTURE
```
organisms/
├── ScoreboardMain/
│   ├── ScoreboardMain.tsx         # Main component
│   ├── ScoreboardMain.types.ts
│   ├── ScoreboardMain.test.tsx
│   ├── ScoreboardMain.constants.ts
│   ├── ScoreboardMainHeader.tsx   # Sub-component
│   ├── ScoreboardMainHeader.test.tsx
│   ├── ScoreboardMainScore.tsx    # Sub-component
│   ├── ScoreboardMainScore.test.tsx
│   ├── ScoreboardMainControls.tsx # Sub-component
│   ├── ScoreboardMainControls.test.tsx
│   ├── useScoreboardState.ts      # Complex custom hook
│   ├── useScoreboardState.test.ts
│   └── ScoreboardMain.utils.ts
│
├── DashboardGrid/
│   ├── DashboardGrid.tsx
│   ├── DashboardGrid.types.ts
│   ├── DashboardGrid.test.tsx
│   ├── DashboardGridCard.tsx      # Sub-component
│   ├── DashboardGridCard.test.tsx
│   ├── DashboardGrid.utils.ts
│   └── DashboardGrid.constants.ts
│
├── HistoryDrawer/
│   ├── HistoryDrawer.tsx
│   ├── HistoryDrawer.types.ts
│   ├── HistoryDrawer.test.tsx
│   └── HistoryDrawer.utils.ts
│
└── index.ts                       # Barrel export

Total: 3 organism folders
Files per organism: 6-12 (main + types + test + sub-components + utilities)
```

### PAGES FOLDER STRUCTURE
```
pages/
├── AuthPage/
│   ├── AuthPage.tsx
│   ├── AuthPage.types.ts
│   ├── AuthPage.test.tsx
│   ├── AuthPageForm.tsx           # Sub-component
│   ├── AuthPageForm.test.tsx
│   └── AuthPage.constants.ts
│
├── DashboardPage/
│   ├── DashboardPage.tsx
│   ├── DashboardPage.types.ts
│   ├── DashboardPage.test.tsx
│   ├── DashboardPageHeader.tsx
│   ├── DashboardPageContent.tsx
│   └── DashboardPage.utils.ts
│
├── (3 more pages - same pattern)
│
├── index.ts                       # Barrel export
└── types.ts                       # Shared page types

Total: 5 page folders
Files per page: 4-7
```

### HOOKS FOLDER STRUCTURE
```
hooks/
├── useMatchDisplay/
│   ├── useMatchDisplay.ts         # Hook implementation
│   ├── useMatchDisplay.types.ts   # Return types
│   ├── useMatchDisplay.test.ts    # Unit tests (95%+)
│   ├── useMatchDisplay.constants.ts
│   └── useMatchDisplay.utils.ts   # Helper functions
│
├── (future custom hooks)
│
└── index.ts                       # Barrel export

Total: 1+ hook folders
Files per hook: 3-5
```

---

## MIGRATION STRATEGY

### Step 1: Create New Folder Structures (No Refactor Yet)
```bash
# Create folders for components, keeping old files
mkdir -p client/src/components/atoms/Button
mkdir -p client/src/components/molecules/PageHeader
mkdir -p client/src/components/organisms/ScoreboardMain
# ... etc for all components
```

### Step 2: Copy & Organize (1 component at a time)
```bash
# For Button
cp client/src/components/atoms/Button.tsx ./client/src/components/atoms/Button/Button.tsx
cp client/src/components/atoms/Button.test.tsx ./client/src/components/atoms/Button/Button.test.tsx
```

### Step 3: Extract Types & Constants
```typescript
// Button/Button.types.ts - Extract interfaces from Button.tsx
// Button/Button.variants.ts - Extract style constants
```

### Step 4: Create Barrel Exports
```typescript
// atoms/index.ts - Export all atoms
// molecules/index.ts - Export all molecules
// organisms/index.ts - Export all organisms
```

### Step 5: Update All Imports (Use IDE Find & Replace)
```typescript
// Find: import { Button } from '../components/atoms/Button'
// Replace: import { Button } from '@/components/atoms'
```

### Step 6: Delete Old Files
```bash
# Once all imports updated
rm client/src/components/atoms/Button.tsx
rm client/src/components/atoms/Button.test.tsx
```

---

## TESTING WITH NEW STRUCTURE

### Test File Location
```
Button/
├── Button.tsx                 ← Component
└── Button.test.tsx            ← Test file (same folder)
```

### Running Tests
```bash
# All tests
npm run test

# Specific component
npm run test -- Button.test

# Watch mode for a component
npm run test -- Button.test --watch

# With coverage
npm run test -- --coverage Button
```

### Coverage Reports
```
Coverage will be organized by:
- atoms/ (9 components) → target 90%+
- molecules/ (7 components) → target 85%+
- organisms/ (3 components) → target 80%+
- pages/ (5 components) → target 75%+
- hooks/ (1 hook) → target 95%+

HTML report: coverage/index.html
```

---

## BENEFITS OF THIS STRUCTURE

### 1. **Colocation** 🎯
```
✅ Component + Tests together (easier to find and update)
✅ Fast iteration: Edit component, see test fail/pass immediately
✅ Types co-located with component
```

### 2. **Scalability** 📈
```
✅ Easy to add sub-components (HistoryList.tsx + HistoryListItem.tsx)
✅ Easy to add utilities for complex components
✅ Easy to add custom hooks for data management
```

### 3. **Maintainability** 🛠️
```
✅ Clear file responsibilities (component, types, test, constants)
✅ Easier to understand component scope
✅ Easier to find related code
```

### 4. **Reusability** 🔄
```
✅ Barrel exports make imports clean
✅ Easy to export sub-components
✅ Easy to compose molecules into organisms
```

### 5. **Testing** ✅
```
✅ Tests live next to component (TDD friendly)
✅ Easy to maintain test-to-code ratio
✅ Easy to track coverage per component
```

---

## FILE ORGANIZATION CHECKLIST

### For Each ATOM (9 total)
- [ ] Create folder: `atoms/ComponentName/`
- [ ] Create: `ComponentName.tsx` (component only)
- [ ] Create: `ComponentName.types.ts` (interfaces)
- [ ] Create: `ComponentName.test.tsx` (tests)
- [ ] Create: `ComponentName.variants.ts` or `.constants.ts` (if needed)
- [ ] Create: `ComponentName.utils.ts` (if needed)
- [ ] Update: `atoms/index.ts` with barrel export
- [ ] Verify: All tests pass, coverage 90%+

### For Each MOLECULE (7 total)
- [ ] Create folder: `molecules/ComponentName/`
- [ ] Create: `ComponentName.tsx`
- [ ] Create: `ComponentName.types.ts`
- [ ] Create: `ComponentName.test.tsx`
- [ ] Create: `SubComponent.tsx` (if exists)
- [ ] Create: `SubComponent.test.tsx`
- [ ] Create: `ComponentName.utils.ts` (if needed)
- [ ] Update: `molecules/index.ts`
- [ ] Verify: Coverage 85%+

### For Each ORGANISM (3 total)
- [ ] Create folder: `organisms/ComponentName/`
- [ ] Create: `ComponentName.tsx`
- [ ] Create: `ComponentName.types.ts`
- [ ] Create: `ComponentName.test.tsx`
- [ ] Create: `SubComponent.tsx` (x2-3)
- [ ] Create: `SubComponent.test.tsx` (x2-3)
- [ ] Create: `useComponentState.ts` (if complex)
- [ ] Create: `useComponentState.test.ts`
- [ ] Update: `organisms/index.ts`
- [ ] Verify: Coverage 80%+

### For Each PAGE (5 total)
- [ ] Create folder: `pages/PageName/`
- [ ] Create: `PageName.tsx`
- [ ] Create: `PageName.types.ts`
- [ ] Create: `PageName.test.tsx`
- [ ] Create: `PageNameSection.tsx` (if needed)
- [ ] Create: `PageNameSection.test.tsx`
- [ ] Update: `pages/index.ts`
- [ ] Verify: Coverage 75%+

### For Each HOOK (1 total)
- [ ] Create folder: `hooks/useHookName/`
- [ ] Create: `useHookName.ts`
- [ ] Create: `useHookName.types.ts`
- [ ] Create: `useHookName.test.ts`
- [ ] Update: `hooks/index.ts`
- [ ] Verify: Coverage 95%+

---

## IMPORT/EXPORT PATTERNS

### ❌ DON'T DO THIS (Long relative paths)
```typescript
import { Button } from '../../../components/atoms/Button'
import { PageHeader } from '../../../components/molecules/PageHeader'
```

### ✅ DO THIS (Barrel exports at each level)
```typescript
import { Button } from '@/components/atoms'
import { PageHeader } from '@/components/molecules'
```

### ✅ OR THIS (Category level)
```typescript
import { Button, PinInput, Badge } from '@/components/atoms'
import { PageHeader, FormField } from '@/components/molecules'
```

### ✅ OR THIS (Everything from components)
```typescript
import { Button, PageHeader, ScoreboardMain } from '@/components'
```

---

## PATH ALIASES (tsconfig.json)

Ensure your `tsconfig.json` has:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components": ["src/components/index.ts"],
      "@/components/*": ["src/components/*"],
      "@/pages": ["src/pages/index.ts"],
      "@/pages/*": ["src/pages/*"],
      "@/hooks": ["src/hooks/index.ts"],
      "@/hooks/*": ["src/hooks/*"]
    }
  }
}
```

---

## UPDATED TESTING PLAN

### Phase 1: Setup Folder Structure (2 hours)
- [ ] Create folders for all components
- [ ] Update tsconfig.json with path aliases
- [ ] Create setup.ts and test-utils.tsx
- [ ] Create barrel exports (index.ts files)
- **Files:** 20+ index/setup files
- **Output:** Clean folder structure

### Phase 2: Atoms Tests (7 hours)
- [ ] Reorganize 9 atom files into folders
- [ ] Create .types.ts files (extract interfaces)
- [ ] Create .variants.ts or .constants.ts for each
- [ ] Write unit tests (90%+ coverage)
- [ ] Update all imports across project
- **Files:** 27+ files (9 components × 3 files avg)
- **Coverage:** 90%+

### Phase 3: Molecules Tests (7-8 hours)
- [ ] Reorganize 7 molecule files into folders
- [ ] Extract sub-components into separate folders
- [ ] Create .types.ts and .utils.ts files
- [ ] Write integration tests (85%+ coverage)
- **Files:** 35+ files (7 components × 5 files avg)
- **Coverage:** 85%+

### Phase 4: Organisms Tests (9-10 hours)
- [ ] Reorganize 3 organism files into folders
- [ ] Extract sub-components (ScoreboardMainHeader, DashboardGridCard, etc.)
- [ ] Extract custom hooks (useScoreboardState, etc.)
- [ ] Write comprehensive tests (80%+ coverage)
- **Files:** 40+ files (3 components × 13 files avg)
- **Coverage:** 80%+

### Phase 5: Pages Tests (9 hours)
- [ ] Reorganize 5 page files into folders
- [ ] Extract major sections as sub-components
- [ ] Create page-level tests (75%+ coverage)
- **Files:** 30+ files (5 pages × 6 files avg)
- **Coverage:** 75%+

### Phase 6: Hooks Tests (2-3 hours)
- [ ] Reorganize hooks into folders
- [ ] Create useMatchDisplay folder structure
- [ ] Write comprehensive hook tests (95%+ coverage)
- **Files:** 5 files (hook + test + types + utils + constants)
- **Coverage:** 95%+

### Phase 7: Final Cleanup (2-3 hours)
- [ ] Update all imports (use IDE find & replace)
- [ ] Remove old files
- [ ] Verify all tests pass
- [ ] Generate coverage report
- [ ] Setup CI/CD pipeline
- **Files:** CI/CD configuration files

---

## TOTAL EFFORT WITH NEW STRUCTURE

| Phase | Hours | Files | Coverage |
|-------|-------|-------|----------|
| Setup | 2h | 20+ | - |
| Atoms | 7h | 27+ | 90%+ |
| Molecules | 7-8h | 35+ | 85%+ |
| Organisms | 9-10h | 40+ | 80%+ |
| Pages | 9h | 30+ | 75%+ |
| Hooks | 2-3h | 5 | 95%+ |
| Cleanup | 2-3h | CI/CD | - |
| **TOTAL** | **~42-47h** | **150+** | **80%+** |

**Timeline:** ~2-3 weeks full-time or 1 month part-time

---

## FINAL STRUCTURE PREVIEW

```
client/src/
├── components/
│   ├── atoms/
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.test.tsx
│   │   │   ├── Button.types.ts
│   │   │   └── Button.variants.ts
│   │   ├── PinInput/
│   │   ├── TextInput/
│   │   ├── NumberInput/
│   │   ├── Badge/
│   │   ├── Icon/
│   │   ├── Typography/
│   │   ├── Input/
│   │   ├── ConnectionStatus/
│   │   └── index.ts              ← ONE EXPORT FOR ALL ATOMS
│   │
│   ├── molecules/
│   │   ├── PageHeader/
│   │   ├── FormField/
│   │   ├── ScoreDisplay/
│   │   ├── StatCard/
│   │   ├── TableStatusChip/
│   │   ├── HistoryList/
│   │   ├── MatchContext/
│   │   └── index.ts              ← ONE EXPORT FOR ALL MOLECULES
│   │
│   ├── organisms/
│   │   ├── ScoreboardMain/
│   │   │   ├── ScoreboardMain.tsx
│   │   │   ├── ScoreboardMain.test.tsx
│   │   │   ├── ScoreboardMain.types.ts
│   │   │   ├── ScoreboardMainHeader.tsx
│   │   │   ├── ScoreboardMainScore.tsx
│   │   │   ├── ScoreboardMainControls.tsx
│   │   │   ├── useScoreboardState.ts
│   │   │   └── useScoreboardState.test.ts
│   │   ├── DashboardGrid/
│   │   ├── HistoryDrawer/
│   │   └── index.ts              ← ONE EXPORT FOR ALL ORGANISMS
│   │
│   └── index.ts                  ← ROOT EXPORT (optional)
│
├── pages/
│   ├── AuthPage/
│   │   ├── AuthPage.tsx
│   │   ├── AuthPage.test.tsx
│   │   ├── AuthPage.types.ts
│   │   └── AuthPageForm.tsx
│   ├── DashboardPage/
│   ├── ScoreboardPage/
│   ├── WaitingRoomPage/
│   ├── HistoryViewPage/
│   ├── index.ts                  ← ONE EXPORT FOR ALL PAGES
│   └── types.ts
│
├── hooks/
│   ├── useMatchDisplay/
│   │   ├── useMatchDisplay.ts
│   │   ├── useMatchDisplay.test.ts
│   │   ├── useMatchDisplay.types.ts
│   │   └── useMatchDisplay.constants.ts
│   └── index.ts                  ← ONE EXPORT FOR ALL HOOKS
│
├── __tests__/
│   ├── setup.ts
│   ├── mocks/
│   │   ├── socket.ts
│   │   ├── auth.ts
│   │   └── index.ts
│   └── utils/
│       └── test-utils.tsx
│
└── index.ts                      ← ROOT EXPORT (optional convenience)
```

---

## NEXT STEPS

1. ✅ Review this structure
2. ⬜ Decide: Implement folder structure first, then tests?
3. ⬜ Create folder hierarchy
4. ⬜ Extract types and constants from existing components
5. ⬜ Start Phase 1: Atoms (lowest risk)
6. ⬜ Gradually migrate each component type
7. ⬜ Update all imports across project
8. ⬜ Run full test suite
9. ⬜ Setup CI/CD with coverage gates

