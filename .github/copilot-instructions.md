# ProjectLoop Instructions

## Project Scope

ProjectLoop is the Unified Document Viewer solution. Use the problem statements
and reference material in `Resources/` to understand the requirements before
designing or implementing behavior. Do not invent requirements not supported by
those resources or an explicit user decision.

## Folder Responsibilities

- `Resources/`: Source problem statements, screenshots, and supporting reference
  material. Inspect the relevant images directly; filenames alone do not describe
  the requirements. Preserve original evidence.
- `Prod/`: Solution design and the ordered steps for working on it. Record design
  decisions, proposed flows, implementation steps, dependencies, and acceptance
  criteria here. This is a design/work-planning folder, not a production deployment
  or generated-build directory.
- `DealershipSystems/`: Mock APIs representing external dealership systems for
  this solution. Keep external-system contracts, sample payloads, and mock
  behavior here, separate from the solution's business logic. Do not treat these
  mocks as live integrations or modify real external systems.
- `src/`: ProjectLoop solution implementation other than the frontend, including
  application logic and integration with the dealership mock APIs. No language,
  framework, or build tooling has been selected in this repository yet; do not
  assume one or scaffold it without a task requiring it.

## Frontend Boundary

- The frontend belongs in the separate `EMFc-experiments` repository, as a new app
  interface under that repository's `src/`, not in this repository's `src/`.
- Reuse EMFc-experiments' existing UI theme, components, layout conventions, and
  tooling. Inspect that repository's instructions and nearby apps before editing.
  Do not introduce a competing theme or a standalone frontend here.
- If EMFc-experiments is unavailable, state that frontend implementation is
  blocked and request access to its workspace instead of creating a substitute.
- Keep frontend API expectations aligned with the ProjectLoop solution and the
  mock external-system contracts in `DealershipSystems/`.

## Working Sequence

1. Inspect the relevant problem material in `Resources/` and identify the intended
   behavior and acceptance criteria. Surface ambiguities instead of guessing.
2. Read or update the relevant design and ordered implementation steps in `Prod/`.
3. Define or adjust the required external-system mock contracts and behavior in
   `DealershipSystems/`, then implement the corresponding solution work in `src/`.
4. For frontend tasks, make the interface changes in EMFc-experiments and reuse
   its established visual language.
5. Validate changed behavior with the relevant repository's existing checks.
   Report what was verified and any checks blocked by missing tooling or access.

Keep changes scoped to the requested work. Preserve folder placeholders until
real content replaces them; their notes describe ownership, not executable code.