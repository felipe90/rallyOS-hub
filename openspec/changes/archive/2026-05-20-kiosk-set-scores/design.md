# Design: kiosk-set-scores

## Decision

Add set scores rendering to `KioskTableCard` using the identical pattern already proven in `TableStatusChip` (lines 121-129).

## Implementation Pattern

Inside the scores section, after the point scores block, add:

```
{currentSets && (currentSets.a > 0 || currentSets.b > 0) && (
  <div className="flex items-center gap-2 mt-2">
    <Typography variant="label" className={...condensed sizing...}>
      Sets:
    </Typography>
    <span className={...font-heading score sizing...}>
      {currentSets.a} - {currentSets.b}
    </span>
  </div>
)}
```

## Sizing

- Normal: label `text-lg md:text-xl`, scores `text-2xl md:text-3xl`
- Condensed: label `text-base md:text-lg`, scores `text-xl md:text-2xl`

## Constraints

- `currentSets` destructured from `table` (already available at line 36)
- Conditional: `currentSets && (currentSets.a > 0 || currentSets.b > 0)`
- Keep in `flex items-center gap-2 mt-2` container — compact, below point scores
- Match Tailwind classes from existing condensed/normal pattern
