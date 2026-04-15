# Project Status - rallyOS-hub

> Última actualización: 2026-04-15

## 🎯 Active TODOs (pending work)

| TODO | Prioridad | Estado |
|------|-----------|--------|
| TODO_SCOREBOARD_ROUTES_REFACTOR.md | P0-P2 | TODO |
| TODO_LINTER_SETUP.md | P1 | TODO |
| TODO_LIMPIAR_MESA.md | P1 | TODO |
| TABLE_PIN_AUTH_TODO.md | P1 | TODO |
| TODO_QR_CODE_DISPLAY.md | P1 | TODO |
| SCOREBOARD_REFACTOR_TODO.md | P1 | TODO |
| ORGANISM_ATOMIC_FIX_TODO.md | P1 | TODO |
| TODO_CLIENT_SECURITY_ALIGNMENT.md | P1 | TODO |
| SECURITY_TESTING_TODO.md | P1 | TODO |
| SECURITY_IMPROVEMENT_TODO.md | P1 | TODO |

---

## ✅ Completed (Archived)

### 2026-04-15 - Technical Debt Resolution
| item | estado |
|------|--------|
| Auth Migration (useAuth → useAuthContext) | ✅ DONE |
| MatchEngine Unit Tests (29 tests) | ✅ DONE |
| Polling Removal + Reconnect Listener | ✅ DONE |
| Quick Fixes (crypto, CORS, console cleanup) | ✅ DONE |
| Socket Handler Decomposition | ✅ DONE |
| Triple Role Architecture | ✅ DONE |

### Previous PRDs
- TRIPLE_ROLE_ARCHITECTURE_PRD (archived)

---

## 📁 Document Structure

```
docs/
├── archived/                    # DONE items (completed work)
│   ├── todos/
│   └── specs-sdd/
├── todos/                      # Active TODOs only
├── specs-sdd/                  # Active SDDs only  
├── prd-plans/                  # PRD documents
├── templates/
└── STATUS.md                  # This file
```

---

## 🔧 Quick Commands

```bash
# Ver TODOs activos
ls docs/todos/

# Ver SDDs activos
ls docs/specs-sdd/

# Buscar en archived
find docs/archived -name "*.md" | grep -i "AUTH"
```

---

## 📝 Notes

- Los TODOs DONE se mueven a `docs/archived/` para mantener foco en lo pendiente
- Los SDDs correspondientes también se archivan
- Este STATUS.md es la única fuente de verdad para el estado del proyecto