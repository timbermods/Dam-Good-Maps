# Map names and descriptions

These files are the M9 vocabulary and text rules. They describe a feature-driven system; they do not change generator code.

## Files

- lexicon.json: words grouped by landform, water, measured qualities, beaver flavour, and whimsy. Every entry has a required feature or measurement.
- patterns.json: forty specific name and description rules plus a deterministic fallback.
- forbidden.json: known real-place and map-title phrases to avoid.
- REPORT.md: sources, choices, thresholds, and limits.

## Evidence and matching

A rule may use only evidence from the generated feature list, MapMetrics, playability analysis, settled water, validation checks, or a named premise role. Feature selectors read the existing feature kind, role, and params. Metric selectors read MapMetrics fields. Analysis selectors read DamSite records returned by analysis.damSites. Derived selectors are limited to the dominant tree species, computed from Pine, Birch, and Oak counts in MapMetrics.species; a tie yields no species adjective.

Condition objects use all/any for boolean groups. A feature condition counts matching features; its where values match feature paths such as params.kind, and comparison objects support gte, lte, gt, lt, and $exists. Metric conditions use a MapMetrics path, an operator, and a value. Analysis conditions select records by measured fields. featureRole is an exact feature role, not a guess based on theme. Roles such as premise/moat-island and premise/caldera-island must be emitted only when the built geometry passes that premise's shape checks.

All listed thresholds are initial breakpoints for the M9 implementation. The names must still pass the M9 hand-check against built maps. A missing measurement means a word is unavailable; it never means the condition passed.

## Picking a name

Match rules against built features and measurements, then choose the highest priority rule, the more specific match, and finally the rule id in alphabetical order. This is deterministic and never draws a random title.

Check the candidate against forbidden.json and the other candidate titles. If it collides, try the next eligible rule. Never append a seed, invent a place name, or use a title word whose lexicon gate fails. If no specific pattern matches, use the fact-based fallback in patterns.json.

## Writing a description

Use the description attached to the matched name rule. Keep the map shape and the way it plays in one or two short sentences. Say each fact once. Add a warning only when a measured threat or shortage supports it. Do not add settings, version, or seed here; PLAN §13 keeps those in separate map metadata.
