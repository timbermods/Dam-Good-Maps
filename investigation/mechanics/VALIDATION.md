# What was checked

- Base: `dev` commit `cfa5990caeaf462de695caf428280da55fc0f7f5`; generator 0.6.0.
- Ran `tools/gen.ts` through the isolated theme/observer loader: six themes × seeds 1–30 at 128², Normal defaults.
- 180/180 final passes. 179 first-attempt passes; Highlands seed 3 retried `start.water` once.
- Retained failed attempts and advisory misses. Four maps miss the reservoir advisory target.
- Checked all 180 recorded file hashes against the generated `.timber` files.
- Checked complete theme/seed coverage, data invariants, summaries and source hashes with `verify.mjs`.
- Passed synthetic measurement cases for mature/dead logs, JsonFloat ripeness, absent dam sites, flat access,
  deep shores and a badwater route cut with `check-measures.ts`.
- Compared River Valley seed 1 from the unadapted CLI against the observed CLI. Both SHA-256 hashes are
  `b1f56a9b5de0abe477c09c3bc3f2b58c6449fe9566eb89411629a7f63d97455d`.

The first measurement reader missed wrapped ripeness values. It was fixed, regression-checked, and all affected rows regenerated.
Every retained row has measurement version 2. No metrics from that failed reader remain in the delivered dataset.

Only this investigation's code was tested. Production code and checks were not changed; the Python oracle and browser suite were
not rerun. Both-validator and browser determinism checks remain requirements for any future production integration.
No game was launched, no colony was played, and no complete-difficulty survival claim is made.

Before publication, `git diff --name-only dev...HEAD` and the working tree are checked for paths outside
`investigation/mechanics/`. The PR is to remain open into `dev`, with no approval, merge, tag or release.
