# agent-conductor – Projektplan

> Status: Entwurf / freigegeben zur Umsetzung
> Stand: 2026-11-06
> Sprache dieses Dokuments: Deutsch. Code, Prompts, Commit-Messages und AGENTS.md: Englisch.

---

## 1. Ziel und Vision

`agent-conductor` ist ein kleines, bewusst einfaches Framework, das AI-Agents zur
Implementierung von Features orchestriert. Als Agent-Harness wird
[OpenCode](https://opencode.ai) verwendet.

Ein Feature durchläuft feste Phasen – **Product Owner → Planner → Coder → Tester →
Reviewer** – wobei zwischen Reviewer und Coder/Tester eine konfigurierbare Schleife
existiert. Das Framework läuft identisch:

- **lokal** in einem Devcontainer (CLI `conductor`)
- **in GitHub Actions** (wiederverwendbarer Workflow, Devcontainer optional; ADR 0014)

Das Ergebnis eines Laufs ist ein **Pull Request**.

Das Projekt selbst wird **AI-first** entwickelt. Deshalb gilt für dieses Repo vom
ersten Commit an ein Satz **harter, maschinell durchgesetzter Leitplanken** (Kapitel 9).

Zusätzlich bietet conductor einen **Guardrail-Assistenten** (`conductor guardrails`,
Abschnitt 4.5, ADR 0015): Er unterstützt Entwickler eines Ziel-Repos dabei, sichere
Leitplanken und Quality Gates einzurichten – sprachübergreifend, von der Analyse bis
zum umgesetzten Pull Request.

### Nicht-Ziele (v1)

- Kein frei definierbarer Workflow-Graph, keine eigenen Rollen (Phasen sind fest).
- Keine parallele Ausführung von Coder und Tester.
- Keine Web-UI / kein Dashboard.
- Kein eigener LLM-Client – sämtliche Modellkommunikation läuft über OpenCode.
- GitHub Copilot als Provider wird in CI nicht unterstützt (nur lokal).

---

## 2. Entscheidungen im Überblick

| #   | Thema                    | Entscheidung                                                                                                                                             |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Sprache                  | TypeScript                                                                                                                                               |
| D2  | Runtime (Auslieferung)   | Node ≥ 22.12 kompatibel (Node 20 EOL); nur `node:*`-APIs, keine `Bun.*`-APIs (Lint)                                                                      |
| D3  | Dev-Tooling              | Bun als Paketmanager, Script-Runner und Bundler (`bun build --target=node`)                                                                              |
| D4  | Test-Runner              | Vitest (wegen Stryker-Support und Node-Kompatibilität)                                                                                                   |
| D5  | OpenCode-Anbindung       | OpenCode V2: `@opencode/client` + privater `opencode serve` pro Run, eine Session pro Phase (ADR 0012)                                                   |
| D6  | Rollen-Definition        | Prompts in der Framework-Config (`conductor.yaml`), mit eingebauten Defaults                                                                             |
| D7  | Einsatzart               | Wiederverwendbares Tool für beliebige Ziel-Repos                                                                                                         |
| D8  | Verteilung               | npm-Paket `agent-conductor`, CLI `conductor`                                                                                                             |
| D9  | Input                    | GitHub Issue (CI) oder Freitext per CLI (lokal)                                                                                                          |
| D10 | Output                   | Pull Request; lokal optional nur Branch (`--no-pr`)                                                                                                      |
| D11 | Pipeline                 | Feste Phasen; konfigurierbar sind Gates, Loops, Limits, Prompts, Modelle, Checks                                                                         |
| D12 | Reihenfolge Coder/Tester | Coder zuerst, dann Tester                                                                                                                                |
| D13 | Gates                    | Konfigurierbar; Default: nach PO und nach Planner                                                                                                        |
| D14 | Gate lokal               | Interaktiver Terminal-Prompt (approve / revise mit Feedback / abort)                                                                                     |
| D15 | Gate CI                  | Ein Draft-PR; PR-Review „Approve" oder Label `conductor:approved` = weiter; „Request changes" = Phase mit Kommentaren wiederholen                        |
| D16 | Loop-Konfiguration       | Max. Iterationen, Reviewer-Verdict als Abbruch, Routing durch Reviewer (coder/tester/both), Verhalten bei Limit                                          |
| D17 | Verhalten bei Limit      | Default `draft_pr` + Label `conductor:needs-human`; alternativ `fail` oder `ask`                                                                         |
| D18 | Harte Checks             | Explizit konfigurierte Shell-Kommandos, vom Framework ausgeführt; Ergebnis ist Input für Reviewer; Reviewer kann bei roten Pflicht-Checks nicht approven |
| D19 | Leitplanken (Tester)     | Tests, statische Regeln, CI-Checks                                                                                                                       |
| D20 | Leitplanken-Schutz       | Coder darf Leitplanken nicht ändern; Erkennung über Glob-Patterns + Tester-Diff; Verstoß → Revert + Finding                                              |
| D21 | Git                      | Ausschließlich durch das Framework. Agents: `git *` per Permission verboten + Verifikation nach jeder Phase                                              |
| D22 | Commits                  | Zwischencommits während des Laufs; am Ende Squash + Force-Push zu einem Commit                                                                           |
| D23 | Artefakte                | `.conductor/runs/<id>/` im Branch; vor finalem Squash entfernt, Inhalte im PR-Body                                                                       |
| D24 | Modelle                  | Default global, pro Rolle überschreibbar                                                                                                                 |
| D25 | Provider                 | OpenAI, GitHub Copilot (nur lokal); erweiterbar über OpenCode-Config                                                                                     |
| D26 | PO-Verhalten             | Requirements + Akzeptanzkriterien + offene Fragen (am Gate sichtbar), kein interaktiver Dialog                                                           |
| D27 | Reviewer-Output          | Strukturiertes JSON, Schema-validiert, Retry bei ungültigem Output                                                                                       |
| D28 | Limits                   | Iterationen, Timeout (pro Phase + gesamt), Kostenlimit (USD)                                                                                             |
| D29 | Agent-Rechte             | Rollenbasiert minimal                                                                                                                                    |
| D30 | Resume                   | `conductor resume <run-id>` aus `state.json`                                                                                                             |
| D31 | Devcontainer             | Eigener Devcontainer für Framework-Entwicklung; für Ziel-Repos optional (ADR 0014)                                                                       |
| D32 | CI-Umgebung              | Wiederverwendbarer Workflow auf normalem Runner; Devcontainer optional (ADR 0014)                                                                        |
| D33 | CI-Trigger               | Issue-Label `conductor`                                                                                                                                  |
| D34 | Sprache                  | Prompts Englisch, Artefakte/PR-Texte in konfigurierbarer Sprache                                                                                         |
| D35 | Linter                   | ESLint (typed) + Prettier                                                                                                                                |
| D36 | Hosting                  | GitHub, mit Branch Protection und CODEOWNERS                                                                                                             |
| D37 | Guardrail-Assistent      | Eigener Modus `conductor guardrails` in v1: Analyse, Gap-Analyse, Vorschlag, Umsetzung als PR; mehrsprachig über Sprach-Profile (ADR 0015)               |

Jede dieser Entscheidungen wird in Phase 0 als ADR in `docs/adr/` festgehalten.

---

## 3. Architektur

### 3.1 Grundprinzip: Ports & Adapters

Die gesamte Orchestrierungslogik ist **reine, I/O-freie Logik** im `core/`. Alle
Seiteneffekte laufen über Ports (Interfaces), die von Adaptern implementiert werden.
Dadurch ist der Kern vollständig mit Fakes testbar und Mutation-Testing-fähig.

```text
┌──────────────────────────────────────────────────────────────┐
│                        cli/  (Entry)                         │
│        run · resume · init · validate-config                 │
└───────────────┬──────────────────────────────────────────────┘
                │ wires adapters into core
┌───────────────▼──────────────────────────────────────────────┐
│                          core/                               │
│  schemas · config · pipeline (state machine) · loop policy   │
│  guardrail policy · prompt assembly · ports (interfaces)     │
└───────▲──────────▲───────────▲───────────▲──────────▲────────┘
        │          │           │           │          │
┌───────┴───┐┌─────┴────┐┌─────┴─────┐┌────┴────┐┌────┴─────┐
│ opencode/ ││   git/   ││  checks/  ││ gates/  ││ github/  │
│AgentRunner││   Vcs    ││CheckRunner││GateHand.││ Forge    │
└───────────┘└──────────┘└───────────┘└─────────┘└──────────┘
```

### 3.2 Verzeichnisstruktur

```text
agent-conductor/
├── .devcontainer/              # Devcontainer für Framework-Entwicklung
├── .github/
│   ├── workflows/
│   │   ├── verify.yml          # Pflicht-Check
│   │   ├── guardrails.yml      # Guardrail-Change-Check
│   │   ├── mutation.yml        # Stryker (PR + nightly)
│   │   └── release.yml         # release-please + npm publish
│   └── CODEOWNERS
├── docs/
│   ├── PLAN.md                 # dieses Dokument
│   └── adr/                    # Architecture Decision Records
├── examples/
│   └── sample-repo/            # E2E-Ziel (Phase 5)
├── scripts/
│   └── setup-github.sh         # Branch Protection, Labels via gh api
├── src/
│   ├── cli/                    # Argument-Parsing, Wiring, Ausgabe
│   ├── core/
│   │   ├── schemas/            # zod: config, state, verdict, artifacts
│   │   ├── config/             # Laden, Defaults, Merge
│   │   ├── pipeline/           # State Machine, Transitions
│   │   ├── loop/               # Iterations-/Routing-/Limit-Policy
│   │   ├── guardrails/         # Pfad-Matching, Verstoß-Erkennung
│   │   ├── prompts/            # Default-Prompts + Assembly
│   │   └── ports/              # Interfaces
│   ├── adapters/
│   │   ├── opencode/
│   │   ├── git/
│   │   ├── checks/
│   │   ├── gates/              # terminal, github
│   │   └── github/
│   └── index.ts
├── test/
│   ├── fakes/                  # Fake-Implementierungen der Ports
│   └── e2e/
├── AGENTS.md
├── conductor.schema.json       # generiert aus zod, Drift-geprüft
├── eslint.config.js
├── .dependency-cruiser.cjs
├── knip.json
├── lefthook.yml
├── stryker.config.json
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

### 3.3 Abhängigkeitsregeln (durch dependency-cruiser erzwungen)

| Von               | Darf importieren                          | Darf **nicht** importieren                                                      |
| ----------------- | ----------------------------------------- | ------------------------------------------------------------------------------- |
| `core/**`         | `core/**`, `zod`                          | `adapters/**`, `cli/**`, `node:*` (außer `node:path` für reine Pfadlogik), SDKs |
| `adapters/<x>/**` | `core/ports`, `core/schemas`, eigene Libs | andere `adapters/<y>/**`, `cli/**`                                              |
| `cli/**`          | alles                                     | –                                                                               |
| `test/fakes/**`   | `core/**`                                 | `adapters/**`                                                                   |
| alle              | –                                         | Zyklen; `src/**` → `test/**`                                                    |

### 3.4 Ports

```ts
interface AgentRunner {
  run(input: AgentRunInput): Promise<AgentRunResult>; // role, prompt, model, permissions, timeout
}
interface Vcs {
  currentHead(): Promise<CommitRef>;
  currentBranch(): Promise<string>;
  createBranch(name: string, base: string): Promise<void>;
  changedFiles(since: CommitRef): Promise<FileChange[]>;
  revertPaths(paths: string[], to: CommitRef): Promise<void>;
  commit(message: string): Promise<CommitRef>;
  squash(since: CommitRef, message: string): Promise<CommitRef>;
  push(opts: { force: boolean }): Promise<void>;
}
interface CheckRunner {
  run(check: CheckConfig): Promise<CheckResult>; // exitCode, stdout/stderr (gekürzt), duration
}
interface GateHandler {
  request(gate: GateRequest): Promise<GateDecision>; // approve | revise(feedback) | abort | pending
}
interface Forge {
  // provider-neutral (ADR 0013); IssueRef is opaque, parsed only by the adapter
  getIssue(ref: IssueRef): Promise<Issue>;
  findPullRequest(branch: string): Promise<PullRequestRef | null>;
  createPullRequest(pr: PullRequestDraft): Promise<PullRequestRef>;
  updatePullRequest(
    ref: PullRequestRef,
    patch: PullRequestPatch,
  ): Promise<void>;
  setDraft(ref: PullRequestRef, draft: boolean): Promise<void>;
  addLabels(ref: PullRequestRef, labels: string[]): Promise<void>;
  removeLabels(ref: PullRequestRef, labels: string[]): Promise<void>;
  listReviews(ref: PullRequestRef, since: number): Promise<Review[]>;
  listComments(ref: PullRequestRef, since: number): Promise<Comment[]>;
  closingReference(ref: IssueRef): string;
}
interface RepoInspector {
  // read-only, used by the guardrail assistant (4.5)
  listFiles(globs: string[]): Promise<string[]>;
  readFile(path: string): Promise<string>;
}
interface Clock {
  now(): Date;
}
interface StateStore {
  load(runId: string): Promise<RunState>;
  save(state: RunState): Promise<void>;
}
```

---

## 4. Pipeline und State Machine

### 4.1 Ablauf

```text
            ┌────────┐   gate?   ┌─────────┐   gate?
  input ──▶ │   PO   │ ───────▶  │ Planner │ ───────▶ ┐
            └────────┘           └─────────┘          │
                                                      ▼
                     ┌────────────────────────────────────────┐
                     │  iteration n                           │
                     │  ┌───────┐   ┌────────┐   ┌────────┐   │
                     │  │ Coder │──▶│ Tester │──▶│ Checks │   │
                     │  └───────┘   └────────┘   └───┬────┘   │
                     │       ▲           ▲           ▼        │
                     │       │  route    │     ┌──────────┐   │
                     │       └───────────┴─────│ Reviewer │   │
                     │                         └────┬─────┘   │
                     └──────────────────────────────┼─────────┘
                                                    │ approve
                                                    ▼
                                         squash → push → PR ready
```

- In Iteration 1 laufen Coder **und** Tester.
- Ab Iteration 2 laufen nur die Rollen, die der Reviewer per `route` angefordert hat
  (`coder` | `tester` | `both`). Checks und Reviewer laufen immer.
- Nach jeder agentischen Phase: Git-Integritätsprüfung (5.3) und Zwischencommit.
- Nach dem Coder: Leitplanken-Prüfung (5.4).

### 4.2 Zustände

```text
created → po_running → po_gate → planner_running → planner_gate
        → iter_coder → iter_tester → iter_checks → iter_review
        → (iter_coder | iter_tester | finalizing)
        → finalizing → done
Jederzeit: → failed | needs_human | aborted | waiting_for_gate
```

`waiting_for_gate` ist ein persistierter Zustand: In CI endet der Job, ein späterer
Workflow-Lauf (ausgelöst durch Review/Label) setzt mit `resume` fort.

### 4.3 Abbruchbedingungen der Schleife

1. Reviewer `verdict: approve` **und** alle `required`-Checks grün → `finalizing`.
2. `iteration >= loop.maxIterations` → `onLimit`.
3. Kosten ≥ `limits.maxCostUsd` → `onLimit`.
4. Gesamtlaufzeit ≥ `limits.totalTimeout` → `onLimit`.
5. Phase überschreitet `limits.phaseTimeout` → Phase gilt als fehlgeschlagen → `onLimit`.

Ein `approve` bei roten Pflicht-Checks wird vom Framework **überschrieben** zu
`changes_requested` mit `route: coder` und einem synthetischen Finding.

### 4.4 `onLimit`-Verhalten

| Wert                 | Verhalten                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `draft_pr` (Default) | Squash, Push, PR bleibt Draft, Label `conductor:needs-human`, offene Findings im PR-Body |
| `fail`               | Run-Status `failed`, Exit-Code ≠ 0, Branch bleibt mit Zwischencommits erhalten           |
| `ask`                | Lokal: Terminal-Prompt (weitere N Iterationen / draft_pr / abort). CI: wie `draft_pr`    |

### 4.5 Guardrail-Assistent (`conductor guardrails`, ADR 0015)

Eigene Pipeline neben der Feature-Pipeline. Ziel: Entwickler eines Ziel-Repos beim
Aufbau sicherer Leitplanken und Quality Gates unterstützen, bevor dort Agents arbeiten.

1. **Analyse** (Guardrail-Analyst, read-only): erkennt Sprachen, Build-Tools,
   Testframeworks, CI, vorhandene Linter/Hooks – pro Teilprojekt (Monorepos).
   Ergebnis: `inventory.json` (Schema-validiert).
2. **Gap-Analyse:** Abgleich des Inventars mit dem Leitplanken-Katalog (s. u.) im
   gewählten Profil (`baseline` | `strict`). Rein in `core`, deterministisch.
3. **Vorschlag:** `guardrails-proposal.md` mit priorisierten Maßnahmen und Begründung
   sowie Vorschlag für `checks` und `guardrails.paths` in `conductor.yaml`.
4. **Gate** (immer aktiv): Mensch wählt Maßnahmen aus (approve / revise / abort).
5. **Umsetzung:** Coder richtet die Werkzeuge ein, Tester prüft, dass das neue
   `verify`-Kommando läuft und tatsächlich Fehler erkennt (z. B. absichtlicher Verstoß).
6. **Review:** Reviewer prüft gezielt auf Abschwächung (gesenkte Schwellen, Ausnahmen,
   nicht ausgeführte Checks). Ergebnis ist ein eigener PR mit Label `guardrails-change`,
   der keinen Produktcode ändert.

Zustände:

```text
created → gr_analyzing → gr_gap_analysis → gr_gate
        → iter_coder → iter_tester → iter_checks → iter_review
        → finalizing → done
```

**Leitplanken-Katalog:** sprachunabhängiger Kern (ein `verify`-Kommando, Git-Hooks,
Branch-Protection, Schutz der Leitplanken-Dateien, `AGENTS.md`, Coverage- und
Mutationsschwellen) plus **Sprach-Profile**, die jedes Gate auf konkrete Werkzeuge abbilden:

| Gate        | TypeScript/JS      | Python              | Go                 | Java/Kotlin       |
| ----------- | ------------------ | ------------------- | ------------------ | ----------------- |
| Typen       | tsc strict         | mypy/pyright strict | Compiler, `go vet` | Compiler          |
| Lint/Format | ESLint, Prettier   | ruff                | golangci-lint      | Checkstyle/detekt |
| Architektur | dependency-cruiser | import-linter       | go-arch-lint       | ArchUnit          |
| Dead Code   | knip               | vulture             | deadcode           | (IDE/Lint-Regeln) |
| Coverage    | Vitest/Jest        | pytest-cov          | `go test -cover`   | JaCoCo            |
| Mutation    | Stryker            | mutmut              | gremlins           | PIT               |

Der Katalog ist **Daten** (zod-Schema in `core/schemas`), kein Code; neue Sprachen
kommen ohne Änderung der Kernlogik hinzu.

Sicherheitsregeln: Analyse ist read-only; Schreibrechte erst nach dem Gate; bestehende
Gates dürfen nur verschärft, nie abgeschwächt werden (Verstoß → Finding `severity: high`);
Integritätsprüfung (5.3) gilt unverändert.

---

## 5. Rollen, Rechte und Sicherheit

### 5.1 Rollen

| Rolle                 | Input                                                            | Output (Datei in `.conductor/runs/<id>/`)                                                           | Rechte                                         |
| --------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **PO**                | Issue/Freitext, Repo (read)                                      | `requirements.md`: Ziel, User Stories, Akzeptanzkriterien, Nicht-Ziele, **offene Fragen**, Annahmen | read-only, webfetch                            |
| **Planner**           | requirements.md, Repo                                            | `plan.md`: betroffene Dateien, Schritte, Teststrategie, Risiken, Leitplanken-Vorschläge             | read-only, webfetch                            |
| **Coder**             | requirements, plan, ggf. Review-Findings                         | Codeänderungen, `coder-notes.md`                                                                    | edit, bash (ohne git), keine Leitplanken-Pfade |
| **Tester**            | requirements, plan, Diff, ggf. Findings                          | Tests, statische Regeln, CI-Checks, `tester-notes.md`                                               | edit, bash (ohne git)                          |
| **Reviewer**          | requirements, plan, Diff, Check-Ergebnisse, Leitplanken-Verstöße | `review-<n>.json`                                                                                   | read-only, bash nur lesend                     |
| **Guardrail-Analyst** | Repo (read), Leitplanken-Katalog                                 | `inventory.json`, `guardrails-proposal.md` (nur im Modus `guardrails`, 4.5)                         | read-only, webfetch                            |

### 5.2 OpenCode-Permissions (ADR 0012)

V2-Regeln `{ action, resource, effect }`, die letzte passende Regel gewinnt. Pro Session:
Rollen-Defaults, dann `roles.<role>.permissions`, dann feste Regeln.

| Rolle             | `edit`  | `shell` | `webfetch`, `websearch` |
| ----------------- | ------- | ------- | ----------------------- |
| `po`, `planner`   | `deny`  | `deny`  | `allow`                 |
| `coder`, `tester` | `allow` | `allow` | `deny`                  |
| `reviewer`        | `deny`  | `deny`  | `deny`                  |

Feste Regeln (nicht überschreibbar): `shell git *`, `shell gh *`, `subagent *`,
`question *`, `read *.env`, `read *.env.*`, `external_directory *` → `deny`. `ask` ist in
der Config nicht erlaubt; fragt OpenCode trotzdem, lehnt der Adapter ab.

Ausnahme: Die Rollen PO, Planner und Reviewer schreiben ihre Artefakte nicht selbst.
Sie liefern ihr Ergebnis als Antwort, das Framework schreibt die Datei.

### 5.3 Git-Integritätsprüfung (nach jeder Phase)

1. `HEAD` vor und nach der Phase identisch.
2. Branch unverändert.
3. Keine neuen Refs/Tags, `.git/config` unverändert (Hash).
4. Keine Änderungen in `.git/hooks`.

Verstoß → Run `failed` (kein Recovery, da Vertrauen gebrochen).

### 5.4 Leitplanken-Schutz (Coder)

- **Leitplanken-Menge** = Dateien, die auf `guardrails.paths` matchen ∪ Dateien,
  die der Tester in diesem Run angelegt/geändert hat.
- Coder-Änderungen auf dieser Menge werden auf den Stand vor der Coder-Phase
  zurückgesetzt (`revertPaths`).
- Jeder Verstoß erzeugt ein Finding (`severity: high`, `source: framework`), das an
  Reviewer und in der nächsten Iteration an den Coder geht.
- Ein Revert zählt **nicht** als zusätzliche Iteration, die Iteration läuft normal weiter.

### 5.5 Reviewer-Verdict (Schema)

```json
{
  "verdict": "approve | changes_requested",
  "route": "coder | tester | both",
  "summary": "string",
  "findings": [
    {
      "id": "string",
      "severity": "low | medium | high | critical",
      "target": "coder | tester",
      "file": "string?",
      "line": "number?",
      "message": "string",
      "suggestion": "string?"
    }
  ]
}
```

- Validierung mit zod. Bei ungültigem Output: bis zu 2 Retries in derselben Session
  mit Fehlerbeschreibung. Danach Phase `failed` → `onLimit`.
- `route` ist bei `approve` irrelevant und wird ignoriert.

---

## 6. Konfiguration (`conductor.yaml` im Ziel-Repo)

```yaml
# yaml-language-server: $schema=https://unpkg.com/agent-conductor/conductor.schema.json
version: 1

language: de # Sprache der Artefakte und PR-Texte

models:
  default: openai/gpt-5
  planner: openai/o3
  reviewer: openai/o3

gates:
  po: true
  planner: true

loop:
  maxIterations: 3
  onLimit: draft_pr # draft_pr | fail | ask

limits:
  phaseTimeout: 20m
  totalTimeout: 2h
  maxCostUsd: 10

checks:
  - name: typecheck
    command: bun run typecheck
    required: true
    timeout: 5m
  - name: test
    command: bun run test
    required: true
    timeout: 10m
  - name: lint
    command: bun run lint
    required: false

guardrails:
  paths:
    - "**/*.test.ts"
    - "eslint.config.*"
    - ".dependency-cruiser.*"
    - ".github/workflows/**"
  assistant: # nur für `conductor guardrails` (4.5)
    profile: strict # baseline | strict
    languages: [auto] # auto | typescript | python | go | java | kotlin
    exclude: ["vendor/**"]

git:
  baseBranch: main
  branchPrefix: conductor/
  commitMessage: "feat: {{title}}" # finaler Squash-Commit

github:
  labels:
    trigger: conductor
    approved: conductor:approved
    needsHuman: conductor:needs-human

roles: # optional, überschreibt Defaults
  coder:
    prompt: |
      Additional project-specific instructions …
    promptMode: append # append | replace
    permissions:
      - {
          action: webfetch,
          resource: "https://docs.example.com/*",
          effect: allow,
        }
```

- Schema in zod definiert, `conductor.schema.json` daraus generiert.
- Unbekannte Keys → Fehler (strict).
- `conductor validate-config` prüft die Datei.
- Fehlt die Datei, gelten Defaults; `checks` leer → Warnung.

---

## 7. Laufzeitverhalten

### 7.1 Lokal

```bash
conductor run "Add CSV export to report page"
conductor run --issue owner/repo#42     # Issue als Input, PR lokal erstellen
conductor run --no-pr "…"               # nur lokaler Branch
conductor resume <run-id>
conductor init                           # erzeugt conductor.yaml + Workflow-Vorlage
conductor validate-config
```

Ablauf:

1. Arbeitsverzeichnis muss sauber sein (sonst Abbruch).
2. Branch `conductor/<run-id>-<slug>` von `baseBranch`.
3. `opencode serve` wird als Kindprozess auf freiem Port gestartet, nach dem Lauf beendet.
4. Gates: interaktiver Prompt mit Anzeige des Artefakts (inkl. offener Fragen).
5. Am Ende: Squash, Push, PR (sofern nicht `--no-pr`; benötigt `gh`, angemeldet per `gh auth login` oder `GH_TOKEN`; ADR 0013).

### 7.2 GitHub Action (ADR 0014)

**Workflow im Ziel-Repo (von `conductor init --ci` erzeugt):**

```yaml
name: conductor
on:
  issues: { types: [labeled] }
  pull_request_review: { types: [submitted] }
  pull_request: { types: [labeled] }

jobs:
  conductor:
    uses: <owner>/agent-conductor/.github/workflows/conductor-reusable.yml@v1
    permissions: { contents: write, pull-requests: write, issues: write }
    secrets:
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

Einmalig im Ziel-Repo: Secret anlegen, „Allow GitHub Actions to create and approve pull
requests“ aktivieren, `limits.maxCostUsd` in `conductor.yaml` setzen.

**Wiederverwendbarer Workflow (in diesem Repo):** Concurrency pro Issue/PR, Checkout
(`fetch-depth: 0`, bei PR-Events der PR-Branch), conductor und OpenCode installieren
(bis Phase 5 aus dem Quellcode gebaut), `conductor ci`, Artefakte als Actions-Artifact.

**`conductor ci`:** liest das Event (`GITHUB_EVENT_NAME`, `GITHUB_EVENT_PATH`) und
entscheidet in `core/ci/` provider-neutral:

1. Label `conductor` am Issue (von jemandem mit Schreibrecht) → `run --issue <ref> --gates pr`.
2. Nach PO: Draft-PR mit `requirements.md`; Zustand `waiting_for_gate`, Job endet.
3. Review auf einem Branch `conductor/*` oder Label `conductor:approved` → `resume --gates pr <run-id>`
   (Run-ID aus dem Branchnamen). Die Gate-Auswertung aus Phase 3 entscheidet über
   approve, revise oder weiter warten.
4. Analog für Planner- und finales Gate.
5. Schleife läuft ohne Gate durch. Am Ende: Squash, Force-Push, PR wird „Ready for
   review“ (oder bleibt Draft + `conductor:needs-human`).
6. Alle anderen Events → `skip` mit Begründung im Log.

### 7.3 Run-State

`.conductor/runs/<run-id>/state.json` (zod-validiert, versioniert):

```json
{
  "schemaVersion": 1,
  "runId": "20261106-ab12",
  "status": "waiting_for_gate",
  "phase": "planner_gate",
  "iteration": 0,
  "input": {
    "kind": "issue",
    "ref": "owner/repo#42",
    "title": "…",
    "body": "…"
  },
  "baseCommit": "…",
  "branch": "conductor/20261106-ab12-csv-export",
  "pullRequest": 123,
  "costUsd": 1.42,
  "startedAt": "…",
  "testerTouchedPaths": [],
  "history": [
    { "phase": "po", "sessionId": "…", "costUsd": 0.3, "durationMs": 41000 }
  ]
}
```

### 7.4 Finalisierung

1. `.conductor/runs/<id>/` aus dem Branch entfernen.
2. Squash aller Commits seit `baseCommit` zu einem Commit (`git.commitMessage`).
3. Force-Push (`--force-with-lease`).
4. PR-Body: Requirements, Plan (eingeklappt), finales Review, Check-Ergebnisse,
   Kosten, Iterationen, Link zum Issue (`Closes #42`).
5. Vollständige Artefakte zusätzlich als Actions-Artifact (CI) bzw. in
   `~/.local/share/agent-conductor/runs/<id>/` (lokal) archiviert.

---

## 8. Devcontainer

### 8.1 Devcontainer in Ziel-Repos (optional, ADR 0014)

- Kein Pflicht-Feature: Der Workflow läuft standardmäßig auf einem normalen Runner.
- Später optional: Input `devcontainer: true` führt `conductor ci` im Devcontainer des
  Ziel-Repos aus (`devcontainers/ci`); dafür ggf. ein Feature, das Node, OpenCode, `gh`
  und `agent-conductor` installiert (Backlog).

### 8.2 Devcontainer für dieses Projekt

- Base: `mcr.microsoft.com/devcontainers/typescript-node`
- Features: Bun, GitHub CLI, OpenCode
- `postCreateCommand`: `bun install && bunx lefthook install`
- Damit ist die lokale Entwicklungsumgebung identisch zur CI.

---

## 9. Leitplanken für dieses Projekt (AI-first)

**Grundsatz:** Alles, was ein Agent falsch machen kann, muss von einer Maschine
abgelehnt werden. Prosa (AGENTS.md) ist Ergänzung, nicht Durchsetzung.

### 9.1 TypeScript

`tsconfig.json`:

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`
- `verbatimModuleSyntax: true`, `module: NodeNext`

### 9.2 ESLint + Prettier

- `typescript-eslint` `strictTypeChecked` + `stylisticTypeChecked`
- Verboten: `any`, `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error` ohne Beschreibung,
  non-null assertion `!`, `as`-Casts außer `as const` (Regel
  `consistent-type-assertions: { assertionStyle: "never" }` mit gezielten Ausnahmen in
  `adapters/`)
- `no-restricted-globals` / `no-restricted-syntax`: `Bun`, `Deno`
- `no-console` außer in `src/cli/**`
- `max-lines: 250` pro Datei, `max-lines-per-function: 60`, `complexity: 10`,
  `max-depth: 3`, `max-params: 3`
- `eslint-plugin-import`: keine Default-Exports, sortierte Imports
- `switch-exhaustiveness-check`
- `eslint-disable`-Kommentare nur mit Begründung (`eslint-comments/require-description`)
  und nie für die Regeln oben (`eslint-comments/no-restricted-disable`)
- Prettier: Default-Config, via `eslint-config-prettier` entkoppelt

### 9.3 Architektur

- `dependency-cruiser` mit den Regeln aus 3.3
- Zusätzlich: keine verwaisten Module, keine Abhängigkeit auf `devDependencies` aus `src/`

### 9.4 Dead Code

- `knip`: keine ungenutzten Dateien, Exports, Typen, Dependencies

### 9.5 Tests und Coverage

- Vitest, Coverage via `@vitest/coverage-v8`
- Schwellen: `src/core/**` 90 % (lines, branches, functions, statements),
  sonst 80 %
- Jede Datei in `src/**/*.ts` (außer `index.ts`, reine Typ-Dateien) braucht eine
  zugehörige `*.test.ts` – geprüft durch ein kleines Script in `verify`
- Keine `.only`, `.skip` (ESLint `vitest/no-focused-tests`, `vitest/no-disabled-tests`)
- Node-Smoke-Test: gebautes Bundle wird mit `node dist/index.js --version` ausgeführt

### 9.6 Mutation Testing

- Stryker mit `@stryker-mutator/vitest-runner` + TypeScript-Checker, Scope `src/**`
  (ohne Tests und `index.ts`); bei Laufzeitproblemen später auf `src/core/**` einschränken
- PR (nur bei Änderungen in `src/`): inkrementell gegen den Cache des letzten
  Nightly-Laufs, Mindest-Score 80
- Nightly: vollständig, Report als Artifact

### 9.7 Git-Hooks (lefthook)

- `pre-commit`: Prettier (check), ESLint, `tsc --noEmit` auf geänderten Dateien
- `commit-msg`: Conventional Commits (commitlint)
- `pre-push`: `bun run verify:fast` (ohne Mutation)

### 9.8 Schutz der Leitplanken

**Leitplanken-Dateien:**
`tsconfig*.json`, `eslint.config.*`, `.prettierrc*`, `.dependency-cruiser.*`,
`knip.json`, `vitest.config.*`, `stryker.config.*`, `lefthook.yml`,
`commitlint.config.*`, `.github/**`, `scripts/**`, `AGENTS.md`,
`package.json#scripts` (Diff-basiert geprüft).

**Durchsetzung:**

1. `CODEOWNERS`: Leitplanken-Dateien (und `package.json`) gehören `@patrickhofmann0`;
   Branch Protection erzwingt Code-Owner-Review nur für diese Dateien.
2. Workflow `guardrails.yml`: Ändert ein PR Leitplanken-Dateien, schlägt der Check fehl,
   außer
   - der PR trägt das Label `guardrails-change` **und**
   - der PR ändert **keine** Dateien in `src/` oder `test/`.
     Das Label zählt nur, wenn es von einem User mit `admin`/`maintain`-Recht gesetzt
     wurde (geprüft über Issue-Events + Collaborator-Permission-API).

### 9.9 Schemas als Single Source of Truth

- zod-Schemas für Config, State, Verdict
- `conductor.schema.json` wird generiert; `verify` prüft, dass die committete Datei
  aktuell ist (kein Drift)

### 9.10 Agent-Kontext

- `AGENTS.md` (Englisch, kurz, < 150 Zeilen): Zweck, Architektur-Regeln, Kommandos,
  „Definition of Done" = `bun run verify` grün, Do/Don't
- `docs/adr/NNNN-title.md` (Vorlage `0000-template.md`); die Entscheidungen aus
  Kapitel 2 sind thematisch in ADR 0001–0010 gebündelt
- Neue Architekturentscheidungen erfordern ein ADR (Reviewer-Checkliste)

### 9.11 Ein Kommando für alles

```jsonc
// package.json scripts
"format:check": "prettier --check .",
"lint":         "eslint . --max-warnings 0",
"typecheck":    "tsc --noEmit",
"arch":         "depcruise src scripts --config .dependency-cruiser.cjs",
"deadcode":     "knip",
"test":         "vitest run --coverage",
"test:pairs":   "bun scripts/verify-test-pairs.ts",
"schema:check": "bun scripts/verify-schema-drift.ts",   // ab Phase 1
"build":        "bun build src/cli/index.ts --target=node --format=esm --outdir dist",
"smoke":        "node dist/index.js --version",
"mutation":     "stryker run",
"verify:fast":  "<format:check> && <lint> && <typecheck> && <arch> && <deadcode> && <test:pairs> && <test>",  // + <schema:check> ab Phase 1
"verify":       "<verify:fast> && <build> && <smoke>"
```

CI führt exakt `bun run verify` aus.

### 9.12 GitHub-Repository-Einstellungen (`scripts/setup-github.sh`)

- Branch Protection auf `main`: Pflicht-Checks `verify`, `guardrails`; Code-Owner-Review
  für Leitplanken-Dateien; keine Force-Pushes; linear history; `enforce_admins: false`
  (der Maintainer kann eigene Leitplanken-PRs per Admin-Bypass mergen)
- Merge-Methoden: nur Squash
- Labels anlegen: `conductor`, `conductor:approved`, `conductor:needs-human`,
  `guardrails-change`
- Ausführung per `gh api`, idempotent

### 9.13 Dokumentation für Menschen (ADR 0011)

- Englisch, Markdown im Repo, Diagramme als Mermaid, keine Doku-Website
- `README.md`, `CONTRIBUTING.md`, `docs/contributing/` (Maintainer), `docs/guide/` (Nutzer)
- `AGENTS.md` verweist auf `docs/contributing/`, dupliziert aber nicht
- Generierbare Referenzen (Config-Referenz aus zod) werden generiert und Drift-geprüft
- Leitplanken: `markdownlint-cli2` (verify + pre-commit), `remark-validate-links` für
  interne Links/Anker (verify), lychee für externe Links (nightly, `docs-links.yml`)

| Wann      | Doku                                                                                                                        |
| --------- | --------------------------------------------------------------------------------------------------------------------------- |
| Phase 0   | `README.md`, `CONTRIBUTING.md`, `docs/contributing/{setup,workflow,guardrails,architecture,testing,working-with-agents}.md` |
| Phase 1   | `docs/guide/concepts.md`, `docs/guide/configuration.md` (generiert)                                                         |
| Phase 2   | `docs/guide/getting-started-local.md`, `docs/guide/security.md`                                                             |
| Phase 3–4 | `docs/guide/getting-started-ci.md`                                                                                          |
| Phase 5   | `docs/guide/troubleshooting.md`, `docs/contributing/release.md`, `CHANGELOG.md`                                             |

---

## 10. Implementierungsphasen

Jede Phase = ein oder mehrere PRs, jeder PR mit grünem `bun run verify`.
**Definition of Done pro Phase:** alle Akzeptanzkriterien erfüllt, Coverage- und
Mutation-Schwellen gehalten, AGENTS.md/ADRs aktualisiert, **Doku für Menschen der Phase
geschrieben bzw. aktualisiert (9.13)**.

### Phase 0 – Fundament & Leitplanken

**Ziel:** Ein leeres, aber vollständig abgesichertes Projekt.

Aufgaben:

- [x] `package.json`, Bun-Setup, `tsconfig.json` (TypeScript 6.0.x, da `typescript-eslint` TS 7 noch nicht unterstützt)
- [x] Devcontainer für Framework-Entwicklung (8.2)
- [x] ESLint + Prettier (9.2)
- [x] dependency-cruiser (9.3) mit Regeln für `src/core`, `src/adapters`, `src/cli`, `test/fakes`
- [x] knip (9.4)
- [x] Vitest + Coverage-Schwellen (9.5), `verify-test-pairs`-Script
- [x] Stryker (9.6)
- [x] lefthook + commitlint (9.7)
- [x] `verify` / `verify:fast` (9.11)
- [x] Workflows: `verify.yml`, `guardrails.yml`, `mutation.yml`
- [x] `CODEOWNERS`, `scripts/setup-github.sh` (9.12)
- [x] `AGENTS.md`, ADRs 0001–0010
- [x] Hello-World-CLI (`conductor --version`) mit Test, Build, Node-Smoke-Test
- [ ] Remote-Repo anlegen, pushen, `scripts/setup-github.sh` ausführen (manuell, Maintainer)
- [x] Hook-Umgebung (`scripts/hook-env.sh`), Doku-Leitplanken, ADR 0011
- [x] Doku für Menschen Phase 0 (9.13)

Akzeptanzkriterien:

- `bun run verify` grün im Devcontainer und in CI
- Ein absichtlich eingeführter Verstoß gegen jede Leitplanke lässt `verify` bzw.
  `guardrails` fehlschlagen (manuell einmal geprüft, dokumentiert im PR)
- Branch Protection aktiv

> Phase 0 wird manuell bzw. eng begleitet umgesetzt, da ab hier die Leitplanken für
> alle folgenden (agentischen) Arbeiten gelten.

### Phase 1 – Kern (ohne I/O)

**Ziel:** Gesamte Orchestrierungslogik, vollständig mit Fakes getestet.

Aufgaben:

- [x] zod-Schemas: Config, RunState, ReviewerVerdict, Findings; Schema-Generierung + Drift-Check
- [x] Config-Parsing (`parseConfig` validiert bereits geparste Daten): Defaults, Merge von Rollen-Prompts (`append`/`replace`), Duration-Parsing. YAML-Datei lesen folgt in Phase 2 (I/O)
- [x] Ports (3.4); zusätzlich `RunStore`, `Publisher`, `Reporter`. `Forge` entfällt im Kern: Push und PR kapselt der `Publisher`
- [x] Pipeline-State-Machine (4.2) inkl. Gates, Resume-Einstieg in jeden Zustand
- [x] Loop-Policy: Routing, Iterationen, Override „approve bei roten Checks", Limits, `onLimit`
- [x] Guardrail-Policy: Glob-Matching, Ermittlung der Leitplanken-Menge, Verstoß → Finding; `.conductor/**` immer geschützt (auch vor dem Tester)
- [x] Prompt-Assembly: Default-Prompts pro Rolle (EN), Kontext-Injection (Requirements, Plan, Diff, Findings, Check-Ergebnisse), Ausgabesprache
- [x] Fakes für alle Ports in `test/fakes/`, Szenario-Tests in `test/scenarios/`
- [x] Doku: `docs/guide/concepts.md`, `docs/guide/configuration.md` (Vollständigkeit per Test gegen das JSON-Schema geprüft)

Ergebnis: 445 Tests, Coverage 100 % Statements / 99 % Branches, Mutation-Score 98,6 %.

Abweichungen vom Entwurf in Kapitel 4/7:

- Zeitlimit zählt nur aktive Zeit (`activeMs`), nicht die Wartezeit an Gates.
- `onLimit: ask` mit „continue" gewährt ein weiteres Budget derselben Größe (Iterationen, Kosten, Zeit).
- Intermediate-Commits nutzen `chore(conductor): …`, damit Commit-Hooks der Ziel-Repos sie akzeptieren.

Akzeptanzkriterien:

- Szenario-Tests mit Fakes: Happy Path; Reviewer routet zu Tester; maxIterations erreicht
  für jedes `onLimit`; Kostenlimit; Timeout; Gate revise; Gate abort; Resume aus jedem
  Gate; Coder verletzt Leitplanke; ungültiges Reviewer-JSON mit erfolgreichem Retry und
  mit Fehlschlag
- Coverage `core/` ≥ 90 %, Mutation-Score ≥ 80

### Phase 2 – Lokale Adapter & CLI

**Ziel:** Ein vollständiger lokaler Lauf mit `--no-pr`.

Aufgaben:

- [x] OpenCode-Adapter: Server-Lifecycle (`opencode serve` auf freiem Port), Session pro Phase, Modell + Permissions pro Rolle, harte `git`-Denies, Kosten aus Session-Metadaten, Timeout/Abort
- [x] Git-Adapter: Branch, Commit, changedFiles, revertPaths, Squash, Push (`--force-with-lease`), Integritätsprüfung (5.3)
- [x] Check-Runner: Shell-Ausführung, Timeout, Output-Kürzung
- [x] Terminal-Gate: Anzeige Artefakt, approve / revise (Editor oder Inline-Feedback) / abort
- [x] StateStore (Datei)
- [x] CLI: `run`, `resume`, `validate-config`, `init` (nur `conductor.yaml`), `--no-pr`
- [x] Adapter-Tests: Git gegen temporäre Repos; OpenCode-Adapter gegen gemockten HTTP-Server
- [x] Fix: `.conductor/runs/*/state.json` von der Leitplanken-Prüfung ausnehmen (wird nach jedem Schritt vom Framework geschrieben und fälschlich als Agent-Änderung zurückgesetzt); CLI-Integrationstest prüft, dass ein normaler Lauf nichts zurücksetzt
- [x] Fix: Archivordner nicht beschreibbar → verständliche Fehlermeldung (Hinweis auf `XDG_DATA_HOME`); `.devcontainer/on-create.sh` setzt Besitzer von `~/.local` und `~/.local/share` auf `node`
- [x] Kostenanzeige im Terminal-Reporter für kleine Beträge mit mehr Nachkommastellen (z. B. `$0.0021` statt `$0.00`)
- [x] CLI: `conductor runs` listet offene Runs im aktuellen Repo (`.conductor/runs/`) mit Run-ID, Status, Schritt, Branch und Start-Zeitpunkt
- [x] Reviewer-Prompt: Sind keine Checks konfiguriert, sagt der Prompt das ausdrücklich („keine automatischen Checks, urteile nach Code-Inspektion“); sonst wartet der Reviewer bis zum Iterationslimit auf Testergebnisse
- [x] CLI: `run` ohne konfigurierte Checks warnt deutlich vor dem Start (statt nur einer `warning:`-Zeile)
- [x] Run-Store: Beim Archivieren leere Ordner `.conductor/runs/` und `.conductor/` im Repo entfernen
- [x] CLI: `conductor show <run-id>` zeigt einen Run (offen oder archiviert): Status, Kosten, Verlauf, Requirements, Plan und alle Review-Zwischenergebnisse (`review-<n>.json`: Verdict, Route, Zusammenfassung, Findings mit Schweregrad, Ziel und Datei)

Akzeptanzkriterien:

- Lokal gegen ein Test-Repo: ein Run läuft durch alle Phasen und erzeugt einen
  Branch mit genau einem Commit
- Versuch eines Agents, `git commit` auszuführen, wird blockiert; manipulierter HEAD
  führt zu `failed`
- Abbruch mit Ctrl-C und anschließendes `resume` funktioniert

### Phase 2b – Nachsteuern

**Ziel:** Ein Mensch kann ein Ergebnis, das ihm noch nicht gefällt, mit Feedback
nachbessern lassen, ohne von vorn zu beginnen.

Aufgaben:

- [x] Finales Gate (`gates.final`, Default `false`): nach Reviewer-Freigabe und grünen Pflicht-Checks, vor `finalize`. Anzeige: Verdict-Zusammenfassung, Check-Ergebnisse, geänderte Dateien (Diffstat). Antworten: approve → `finalize`; revise → Feedback wird Finding (`source: human`, `target: coder`), nächste Iteration mit `route: both`, der Reviewer sieht das Feedback; abort
- [x] Schema: Finding-Quelle `human`; Gate-Name `final`; Schritt `final_gate` in der State Machine
- [x] Iterationen, die durch menschliches Feedback (finales Gate oder `revise`) ausgelöst werden, zählen nicht zum Iterationslimit (`loop.maxIterations` gilt nur für Reviewer-Runden); Kosten- und Zeitlimits gelten weiter
- [x] Run-Store: archivierten Run zurückholen (Gegenstück zu `archive`)
- [x] CLI: `conductor revise --no-pr <run-id> "<feedback>"` öffnet einen Run mit Status `done` oder `needs_human` wieder: Run-Branch muss ausgecheckt und sauber sein; Feedback wird Finding; Reviewer-Runden zählen ab hier neu, Kosten- und Zeitbudget werden erneuert (wie `extensions`); weiter ab Coder; am Ende erneut Squash seit `baseCommit` (Branch hat danach wieder genau einen Commit)
- [x] Doku: Nachsteuern in `docs/guide/local-usage.md` und `docs/guide/concepts.md`

Akzeptanzkriterien:

- Mit `gates.final: true` führt revise am finalen Gate zu einer weiteren Iteration, deren
  Ergebnis das Feedback berücksichtigt; approve finalisiert wie bisher
- `conductor revise` auf einen fertigen Run erzeugt einen Branch mit genau einem Commit,
  der die alte und die neue Änderung enthält
- In CI (Phase 3) entspricht das finale Gate einem Review „Changes requested“ auf dem
  Draft-PR

### Phase 3 – GitHub-Integration

**Ziel:** Issue als Input, PR als Output, PR-Reviews/Labels als Gate.

Anbindung über die `gh`-CLI (ADR 0013).

Aufgaben:

- [x] Port `src/core/ports/forge.types.ts` (provider-neutral, ADR 0013):
  - `getIssue(ref)`: `ref` ist ein undurchsichtiger String, den nur der Adapter parst (`owner/repo#n`, `#n`); `Issue` = Ref, Titel, Body, URL
  - `findPullRequest(branch)`, `createPullRequest({ branch, base, title, body, draft })`, `updatePullRequest(pr, { title, body })`, `setDraft(pr, draft)`
  - `addLabels(pr, labels)`, `removeLabels(pr, labels)`
  - `listReviews(pr, since)` und `listComments(pr, since)` (Autor, `authorCanApprove`, Zustand `approve | request_changes | comment`, Text, Zeitpunkt)
  - `closingReference(ref)` für den PR-Body (z. B. `Closes owner/repo#n`)
- [x] Fake `test/fakes/fake-forge.ts`. Abweichung: keine zod-Schemas für Forge-Typen in `core/schemas`; unbekannte Daten kommen nur im Adapter an und werden dort validiert
- [x] Reine Gate-Auswertung `core/forge/gate-feedback.ts`: zählt nur Rückmeldungen von Nutzern mit `authorCanApprove` nach `gateOpenedAt`. Das Label `conductor:approved` oder das neueste entscheidende Review „Approve“ ergibt `approve`. „Changes requested“ ergibt `revise` mit allen Review-Texten und Kommentaren bis dahin. Sonst `pending`
- [x] State: `gateOpenedAt` (Default `null` für bestehende `state.json`). Der Gate-Schritt setzt den Wert beim ersten Aufruf und löscht ihn bei einer Entscheidung. Abweichung: `pullRequest` wird nicht gespeichert, der PR wird über den Branch gefunden
- [x] Adapter `src/adapters/github-cli/`: `gh.ts` (Subprozess, Body über stdin, Fehlerabbildung), `gh-forge.ts`, `responses.ts` (zod), `refs.ts`, `preflight.ts` (Mindestversion 2.40.0, `gh auth status`)
- [x] Publisher `core/forge/forge-publisher.ts`: Push und danach PR anlegen oder aktualisieren. Bei `gate` bleibt der PR ein Draft, bei `final` wird er Ready (mit `closingReference`), bei `needs_human` bleibt er ein Draft mit dem Label `conductor:needs-human`
- [x] Gate-Handler `core/forge/forge-gate.ts`: Auswertung bei jedem Aufruf, also auch beim `resume`; danach wird `conductor:approved` entfernt. `resolveLimit` liefert `draft_pr`
- [x] Das finale Gate (`gates.final`) entspricht „Changes requested“ auf dem Draft-PR (Akzeptanzkriterium aus Phase 2b)
- [x] PR-Body: `Closes …` kommt vom Forge-Publisher statt aus dem Renderer; der Gate-Hinweis kommt aus `renderGateBody`
- [x] CLI:
  - `run --issue <ref>` liest das Issue (auch mit `--no-pr`)
  - Ohne `--no-pr` werden der Forge-Publisher und weiterhin Terminal-Gates verwendet
  - `--gates pr` nutzt PR-Reviews als Gate, gilt für `run`, `resume` und `revise`
  - `revise` funktioniert jetzt auch ohne `--no-pr`
- [x] Tests: Adapter gegen aufgezeichnete `gh`-Ausgaben mit Prüfung der exakten Argumente; Core- und CLI-Tests mit Fake-Forge und einem Bare-Repo als `origin`
- [x] Doku: `docs/guide/local-usage.md`, `docs/guide/concepts.md`, README
- [ ] Manueller Test gegen ein echtes GitHub-Repository (Akzeptanzkriterien unten)

Akzeptanzkriterien:

- Lokal erzeugt `run --issue` einen Draft-PR, der nach dem Lauf „Ready“ ist
- Gate über PR-Review lokal simulierbar: `run --gates pr` endet in
  `waiting_for_gate`, ein Approve oder „Changes requested“ am PR und anschließend
  `resume` setzen den Lauf korrekt fort
- Fehlt `gh` oder die Anmeldung, bricht der Lauf vor dem ersten Agenten mit einer
  klaren Meldung ab

### Phase 4 – GitHub Actions

**Ziel:** Ein Lauf passiert vollständig in GitHub: Label am Issue → Draft-PR → Approves
im PR → fertiger PR. Ziel-Repos brauchen dafür nur eine kurze Workflow-Datei (ADR 0014).

Aufgaben:

- [ ] `core/ci/`: neutrale Event-Typen (`issue_labeled`, `review_submitted`, `approval_labeled`, `ignored`, jeweils mit `actorCanApprove`) und reine Funktion `dispatch(event, config)` → `run` | `resume` | `skip` (Trigger-Label, Branch-Präfix, Schreibrecht, Run-ID aus Branch)
- [ ] Port `CiEnvironment` (`readEvent()`); Adapter `adapters/github-actions/` liest `GITHUB_EVENT_NAME` und `GITHUB_EVENT_PATH` (zod), getestet mit aufgezeichneten Event-Payloads
- [ ] CLI `conductor ci`: Event lesen, `dispatch`, dann `run`/`resume` mit `--gates pr`; verlangt `limits.maxCostUsd`; Exit-Code 0 bei `skip`
- [ ] CLI `conductor init --ci`: erzeugt `.github/workflows/conductor.yml` (Aufruf des wiederverwendbaren Workflows); überschreibt nichts
- [ ] Wiederverwendbarer Workflow `.github/workflows/conductor-reusable.yml` (der Name `conductor.yml` bleibt frei für den Aufrufer-Workflow dieses Repos in Phase 6): Concurrency pro Issue/PR, Checkout, Installation (bis Phase 5 aus dem Quellcode), `conductor ci`, Artefakt-Upload. **Eigener PR mit Label `guardrails-change`**, ohne Änderungen an `src/` und `test/`
- [ ] Doku: `docs/guide/getting-started-ci.md` (Einrichtung, Ablauf, Kosten, Sicherheit: Issue-Text ist Prompt-Input)

Akzeptanzkriterien:

- In einem Test-Repo: Label setzen → Draft-PR mit Requirements → Approve → Plan →
  Approve → fertiger PR mit einem Commit
- „Request changes" am Plan führt zu überarbeitetem Plan
- Events, die conductor nicht betreffen, beenden den Job in wenigen Sekunden mit `skip`

### Phase 5a – Tarball-Release (ohne npm, vorziehbar)

**Ziel:** conductor lässt sich ohne Bun und ohne npm-Publish in anderen Projekten
installieren, auch bevor Phase 4 (CI) und Keys verfügbar sind.

Aufgaben:

- [ ] Release-Workflow (`.github/workflows/release-tarball.yml`), getriggert durch Tag `v*`: `verify`, Version aus dem Tag setzen, `npm pack`, Install-Test des Tarballs unter Node 22 (`conductor --version`), Tarball an GitHub Release anhängen. **Eigener PR mit Label `guardrails-change`**, ohne Änderungen an `src/` und `test/`
- [ ] Doku `docs/guide/install-local.md`: Installation aus Release (`gh release download`, `npm i -g ./agent-conductor-<version>.tgz`) und Entwicklungsweg via `bun link`; lokaler Lauf mit Copilot-Login ohne API-Key

Akzeptanzkriterien:

- Das Tarball installiert unter Node 22 ohne Bun, `conductor --version` läuft
- Ein Tag erzeugt ein Release mit angehängtem `.tgz`

### Phase 5 – E2E & Release

**Ziel:** Veröffentlichtes, dokumentiertes v1.0.

Aufgaben:

- [ ] `examples/sample-repo` mit kleinem Feature-Issue
- [ ] E2E-Workflow (manuell + nightly) gegen echtes Modell, mit Kostenlimit
- [ ] release-please, npm-Publish mit Provenance, Tag `v1` für den wiederverwendbaren Workflow
- [ ] README: Quickstart lokal, Quickstart CI, Config-Referenz (aus Schema generiert)

Akzeptanzkriterien:

- `npx agent-conductor --version` funktioniert unter Node 22 ohne Bun
- Der wiederverwendbare Workflow installiert das veröffentlichte Paket statt aus dem Quellcode zu bauen
- E2E-Lauf grün

### Phase 6 – Dogfooding

**Ziel:** conductor entwickelt sich selbst weiter.

Aufgaben:

- [ ] `conductor.yaml` in diesem Repo mit `checks` = Teile von `verify`, `guardrails.paths` = Leitplanken-Dateien aus 9.8
- [ ] Workflow im eigenen Repo aktivieren
- [ ] Erste Features (Backlog, Kapitel 12) über conductor umsetzen
- [ ] Learnings → Prompt-Verbesserungen, ADRs

### Phase 7 – Guardrail-Assistent

**Ziel:** `conductor guardrails` richtet in beliebigen Ziel-Repos sichere Leitplanken
und Quality Gates ein (4.5, ADR 0015).

Aufgaben:

- [ ] Schemas: Leitplanken-Katalog, Sprach-Profile, `inventory.json`, Config-Block `guardrails.assistant`
- [ ] Port `RepoInspector` + Adapter (Dateisystem) + Fake
- [ ] Core: Gap-Analyse (Inventar × Katalog × Profil → priorisierte Maßnahmen), Abschwächungs-Erkennung
- [ ] Rolle Guardrail-Analyst mit Default-Prompt; Pipeline-Zustände `gr_*`
- [ ] Sprach-Profile TypeScript/JS, Python, Go, Java/Kotlin
- [ ] CLI `conductor guardrails [--profile] [--report-only]`, Gate lokal und in CI
- [ ] Doku in `docs/` (Nutzung, Katalog erweitern)

Akzeptanzkriterien:

- Je ein Beispiel-Repo pro Sprache: Lauf erzeugt PR, dessen `verify` grün ist und einen eingebauten Verstoß erkennt
- Monorepo mit zwei Sprachen wird pro Teilprojekt korrekt behandelt
- `--report-only` ändert keine Dateien
- Versuchte Abschwächung eines bestehenden Gates führt zu einem `high`-Finding

---

## 11. Risiken & offene Punkte

| Risiko                                                                               | Auswirkung                   | Gegenmaßnahme                                                                                                  |
| ------------------------------------------------------------------------------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| OpenCode-SDK-API ändert sich                                                         | Adapter bricht               | SDK-Version pinnen, Adapter dünn halten, Contract-Tests                                                        |
| Kostenangaben aus OpenCode ungenau/fehlend (z. B. Copilot)                           | Kostenlimit greift nicht     | Fallback auf Token-basierte Schätzung, Warnung                                                                 |
| Agents umgehen `git`-Deny (z. B. über Script-Dateien)                                | Integritätsverlust           | Integritätsprüfung nach jeder Phase (5.3) → `failed`                                                           |
| Coder umgeht Leitplanken durch Änderungen außerhalb der Patterns (z. B. Test-Helper) | Tests geschwächt             | Tester-Diff zählt zur Leitplanken-Menge; Reviewer-Prompt prüft explizit                                        |
| Installation in CI langsam (vor Phase 5: Build aus Quellcode)                        | Lange CI-Zeiten              | Ab Phase 5 veröffentlichtes Paket; Cache für Bun/npm im Workflow                                               |
| Force-Push überschreibt menschliche Commits im PR                                    | Datenverlust                 | `--force-with-lease`; vor Finalisierung prüfen, dass nur conductor-Commits im Branch sind, sonst `needs_human` |
| Stryker-Laufzeit                                                                     | Langsame PRs                 | Inkrementell im PR, vollständig nightly                                                                        |
| Gate-Resume durch Unbefugte (Review von beliebigen Usern)                            | Unkontrollierter Fortschritt | Nur Reviews/Labels von Usern mit Write-Permission werden berücksichtigt                                        |
| Guardrail-Assistent erkennt Sprache/Toolchain falsch                                 | Unpassende Werkzeuge         | Inventar am Gate sichtbar und korrigierbar; Beispiel-Repos pro Sprache als Tests                               |
| Guardrail-PR zu groß / bricht bestehenden Build                                      | Ablehnung durch Entwickler   | Maßnahmen am Gate einzeln wählbar; `baseline`-Profil; Tester prüft `verify` vor Review                         |
| Tool-Versionen der Sprach-Profile veralten                                           | Fehlerhafte Konfiguration    | Versionen im Katalog pinnen, Agent prüft aktuelle Doku (webfetch)                                              |

Offene Punkte (vor der jeweiligen Phase zu klären):

- Erledigt: OpenCode-Anbindung geklärt, siehe ADR 0012 (V2, `@opencode/client` 2.2.5, privater Server).
- Erledigt: GitHub-Anbindung über die `gh`-CLI statt Octokit (ADR 0013).
- Lizenz des Pakets (derzeit `UNLICENSED`) vor dem ersten npm-Release festlegen.
- Erledigt: Reviewer hat standardmäßig keine Shell; Projekte erlauben gezielt Befehle über `roles.reviewer.permissions` (ADR 0012).
- Phase 4: Mindestanforderungen an den Devcontainer des Ziel-Repos (welche Base-Images werden unterstützt).
- Phase 5: Repository-Owner/Namespace für npm, GHCR und Action.

---

## 12. Backlog (nach v1)

- Freie Workflow-Definition / zusätzliche Rollen
- Paralleler Tester (eigener Worktree)
- PO-Dialog mit Rückfragen
- Copilot in CI
- Weitere CI-Systeme (ADR 0014): Gitea Actions (weitgehend GitHub-kompatibel, Forge über `tea`), GitLab CI (kein nativer Label-Trigger, braucht Webhook → Pipeline-Trigger)
- Optionaler Devcontainer im CI-Workflow (Input `devcontainer: true`, ggf. Devcontainer-Feature)
- Weitere Forges (GitLab via `glab`): neuer Adapter `gitlab-cli` + Config-Option `forge` (ADR 0013); Gate-Semantik (Approvals, Labels) und CI-Integration separat klären
- Kosten-/Laufzeit-Reporting über mehrere Runs
- Lokale Isolation über eigenen Worktree pro Run (`workspace: worktree | in-place`, Default zunächst `in-place`): Repo des Nutzers bleibt frei, parallele Runs möglich. Voraussetzungen:
  - Run-Daten außerhalb des Arbeitsverzeichnisses (`.git/conductor/runs/<id>/`, Worktree z. B. unter `.git/conductor/worktrees/<id>/`), eigene ADR
  - `setup`-Befehle in `conductor.yaml` (z. B. `npm ci`), da ein neuer Worktree weder `node_modules` noch ignorierte Dateien wie `.env` hat
  - Integritätsprüfung auf HEAD und Branch des Worktrees, Tags, `.git/config` und Hooks beschränken (Worktrees teilen Refs; Commits des Nutzers auf anderen Branches dürfen den Run nicht abbrechen)
  - Lebenszyklus: Worktree bei `done`, `aborted`, `failed` entfernen (Branch bleibt); bei `waiting_for_gate`, Unterbrechung und `needs_human` behalten; Pfad in `runs`/`show` anzeigen
  - In CI ohne Nutzen (frischer Checkout), daher nur lokal
