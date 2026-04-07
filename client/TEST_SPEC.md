# Test Suite Specification - The Kinetic Clubhouse

## Overview
- **Project**: rallyOS-hub React Client
- **Goal**: Testing suite con Vitest (unit) + Playwright (E2E)
- **Stack**: React 19, Vite 8, TailwindCSS 4, Framer Motion

---

## Unit Tests - Vitest

### Scope
- Componentes átomos, moléculas, organismos
- Hooks (useSocket)
- Tipos compartidos

### Test Structure
```
client/src/
├── components/
│   ├── atoms/
│   │   ├── Typography.test.tsx
│   │   ├── Button.test.tsx
│   │   ├── Badge.test.tsx
│   │   └── Input.test.tsx
│   ├── molecules/
│   │   ├── ScoreDisplay.test.tsx
│   │   ├── TableStatusChip.test.tsx
│   │   ├── StatCard.test.tsx
│   │   └── MatchContext.test.tsx
│   └── organisms/
│       ├── DashboardGrid.test.tsx
│       ├── ScoreboardMain.test.tsx
│       └── HistoryDrawer.test.tsx
├── hooks/
│   └── useSocket.test.ts
└── __mocks__/
    └── socket.ts
```

### Test Cases by Component

#### Atoms

**Typography**
| Test | Input | Expected |
|------|-------|----------|
| render headline | `<Headline>Title</Headline>` | h1 con Space Grotesk |
| render title | `<Title>Sub</Title>` | h2 con Space Grotesk |
| render body | `<Body>Text</Body>` | p con Manrope |
| render label | `<Label>LABEL</Label>` | span uppercase |
| render caption | `<Caption>note</Caption>` | span small |

**Button**
| Test | Input | Expected |
|------|-------|----------|
| render primary | `<Button variant="primary">Click</Button>` | gradient bg |
| render secondary | `<Button variant="secondary">Click</Button>` | tonal bg |
| render live | `<Button variant="live">Live</Button>` | amber gradient |
| click handler | onClick handler | called on click |
| disabled state | `disabled={true}` | not clickable |
| animate | `animate={true}` | has framer motion |

**Badge**
| Test | Input | Expected |
|------|-------|----------|
| waiting badge | `<Badge status="waiting">Text</Badge>` | surface-low bg |
| configuring badge | `<Badge status="configuring">Text</Badge>` | tertiary bg |
| live badge | `<Badge status="live">Text</Badge>` | amber bg with pulse dot |
| finished badge | `<Badge status="finished">Text</Badge>` | primary bg |

**Input**
| Test | Input | Expected |
|------|-------|----------|
| render with label | `<Input label="Name" />` | has label element |
| render with placeholder | `<Input placeholder="..." />` | placeholder text |
| onChange handler | user types | handler called |
| error state | `<Input error="Error" />` | red ring shown |

#### Molecules

**ScoreDisplay**
| Test | Input | Expected |
|------|-------|----------|
| render score | score=5 | displays "5" |
| serving indicator | serving={true} | amber dot shown |
| winner state | winner={true} | ring around component |
| meta text | meta="Player A" | shows meta |

**TableStatusChip**
| Test | Input | Expected |
|------|-------|----------|
| waiting table | status="WAITING" | waiting badge |
| configuring table | status="CONFIGURING" | configuring badge |
| live table | status="LIVE" | live badge |
| finished table | status="FINISHED" | finished badge |

**StatCard**
| Test | Input | Expected |
|------|-------|----------|
| render value | value="42" | displays "42" |
| trend up | trend="up" | green text |
| trend down | trend="down" | red text |

**MatchContext**
| Test | Input | Expected |
|------|-------|----------|
| quarterfinal | phase="quarterfinal" | shows "Cuartos de Final" |
| semifinal | phase="semifinal" | shows "Semifinal" |
| final | phase="final" | shows "Final" |

#### Organisms

**DashboardGrid**
| Test | Input | Expected |
|------|-------|----------|
| render tables list | tables=[...] | renders table chips |
| grid view mode | viewMode="grid" | grid layout |
| list view mode | viewMode="list" | vertical list |
| onTableClick | click table | handler called |

**ScoreboardMain**
| Test | Input | Expected |
|------|-------|----------|
| render match state | match object | shows scores |
| referee mode | isReferee={true} | shows buttons |
| viewer mode | isReferee={false} | no buttons |

**HistoryDrawer**
| Test | Input | Expected |
|------|-------|----------|
| closed by default | isOpen={false} | not visible |
| open animation | isOpen={true} | slides in from right |
| render events | events=[...] | shows event list |

#### Hooks

**useSocket**
| Test | Scenario | Expected |
|-------|----------|----------|
| auto connect | mount | connects to server |
| disconnect | call disconnect() | socket disconnected |
| joinTable emit | call joinTable(id, pin, role) | emits JOIN_TABLE |
| scorePoint emit | call scorePoint('A') | emits SCORE_POINT |
| table update event | receive TABLE_UPDATE | updates tables state |
| match update event | receive MATCH_UPDATE | updates match state |

---

## E2E Tests - Playwright

### Scope
- Full user flows
- Navigation
- Real socket connection
- UI interactions

### Test Structure
```client/tests/
├── e2e/
│   ├── dashboard.spec.ts
│   ├── scoreboard.spec.ts
│   ├── history.spec.ts
│   └── socket.spec.ts
└── playwright.config.ts
```

### Test Cases

**Dashboard Flow**
| Test | Steps | Assertions |
|------|-------|------------|
| load dashboard | navigate to / | shows title, table grid |
| empty state | no tables | shows "Sin mesas" |
| table click | click table | navigates to table |
| view mode toggle | toggle grid/list | changes layout |

**Scoreboard Flow**
| Test | Steps | Assertions |
|------|-------|----------|
| view match | navigate to table | shows scores, players |
| score point A | click A button | score updates |
| score point B | click B button | score updates |
| undo | click undo | score reverts |
| history drawer | open history | shows events |

**Socket Flow**
| Test | Steps | Assertions |
|------|-------|----------|
| connect | page load | connected status |
| table update | server emits | UI updates |
| match sync | server emits | scores sync |

---

## Test Configuration

### Vitest Config (vite.config.ts test override)
```typescript
/// <reference types="vitest" />
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  },
})
```

### Playwright Config
```typescript
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
  },
})
```

---

## Run Commands

```bash
# Unit tests
npm run test              # single run
npm run test -- --watch  # watch mode

# E2E tests
npx playwright test      # run all
npx playwright test -- --ui  # UI mode

# Both
npm run test:all        # vitest + playwright
```

---

## Coverage Targets
- **Unit**: 80% coverage minimum
- **Critical paths**: 100% (ScoreDisplay, useSocket)
- **E2E**: All user flows covered