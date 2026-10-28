# Improve UI Plan

Hãy re-design lại UI với các yêu cầu sau đây:

- Giao diện hiện đại, các component không xài những tone màu đại trà như các web được làm bằng UI. but keep the yellow concept, I love yellows
- UX tối ưu cho việc giảm thiểu thao tác người dùng, hạn chế thông tin dư thừa và không cần thiết
- Vibe của ui sẽ được thiết kế theo hướng hiện đại và sang trọn, và sử dụng darkmode, các bo tròn sử dụng công thức được thiết kế trên macos. Theme selected by user systems.
- Mục Orchestration network hãy design lại cho nó là trọng tâm của tầm nhìn user, các component sẽ được thiết kế theo hướng high tech và phối hợp tone màu hài hòa, các flow của các component cũng sẽ được thiết kế sao cho đúng logic
- Mục Agent nên tối ưu số lượng thôn tin và bố cục và giúp dễ phân biệt các agent khác nhau thay vì màu
- Design chart bằng hướng tối ưu và sang trọng
- Các effect dự án có thể sử dụng thư viện này : https://reactbits.dev/ và https://heroui.com/ but we do it in Angular
- Effect phải thật mượt mà và clean, không gây giật lag cho trang (nếu có). Ưu tiên việc cãi thiện UI-UX hơn việc làm effect
- reduce the duplicated content and also too obvious info to user like "this is an obvious action that would happen in background, we click this and tracker will record"

## Anti-AI-Slop Token & UI/UX Checklist (Mandatory across all SingleUI apps)

### 1. Structural & Layout Anti-Slop Rules
- **No Card-in-Card Nesting (`panel` inside `panel`)**: Never place `.panel` or `.target-card` cards inside another bordered `.panel`. If a section contains a grid of cards (e.g., Farm `#projects`, `#api`, or ProductionCore Aids service groups), set `[flat]="true"` on the enclosing `<emfc-panel>`. If a section is a structured register (e.g., Farm `#experience`, `#tools`, `#cases`), render a `<div class="table-wrap"><table class="table table--stack">` inside a single `<emfc-panel>`.
- **No Unsolicited Diagnostic Blocks or Duplicate Links**: Do not add internal data endpoints (such as `/api/portfolio/gigs`) to the public API console, and do not render duplicate GitHub/LinkedIn `socialLinks` inside `#overview` when `/api/feeds` and `#sources` already display them.
- **No Duplicate Action Labels in Toolbars**: On the Farm home page header, the Sign-in button (`farm-account-menu`) renders only the sign-in icon (`LogIn` with `aria-label`/`title`), because the adjacent secondary button already states `"Connect your AI"`.
- **No Unnecessary Gradients or Stacked Heavy Shadows**: Keep surfaces flat or restrained to the single `--shadow-card` token; do not add diagonal hero gradients, animated card sheen gradients, or double-stacked drop shadows.
- **No Fake Pulsing Status Dots / Decorative LEDs**: Never add decorative `.status-dot` or `.picker-led` circles next to static dropdowns or viewport labels (`LIVE 3D / SCHEMATIC STUDY`) when no real-time telemetry state is being communicated.
- **No Duplicate / Ambiguous Icon Buttons**: Never use plain text `?` for multiple unrelated actions (e.g., both Help and Troubleshoot). Every icon button must have a distinct, semantic SVG icon and an explicit accessible label.
- **No Decorative Left-Border Accent Stripes on Cards**: Reserve `border-left` callout stripes strictly for `.notice` / `.error` / `.safety-note` alerts, never for routine data cards or list items.

### 2. Lexical & Copy Anti-Slop Tokens (Banned Patterns)
- **Banned AI-Slop Vocabulary**:
  - *Verbs*: `delve`, `elevate`, `unleash`, `unlock`, `harness`, `empower`, `streamline`, `supercharge`, `revolutionize`, `foster`, `navigate`, `embark`, `spearhead`, `orchestrate` (unless referring literally to the PARA orchestration graph).
  - *Adjectives*: `seamless`, `cutting-edge`, `next-gen`, `game-changing`, `robust`, `comprehensive`, `holistic`, `bespoke`, `curated`, `effortless`, `vibrant`, `pivotal`, `ever-evolving`.
  - *Nouns*: `tapestry`, `symphony`, `testament`, `realm`, `landscape`, `paradigm`, `synergy`, `ecosystem` (unless literal), `beacon`, `nexus`.
- **Banned Two-Fragment Marketing Taglines**:
  - Never write pseudo-poetic two-fragment slogans like `"Long lines. Mechanical soul."`, `"Small footprint. Clever engineering."`, `"Curiosity, with care."`, or `"Built for speed. Designed for you."`
  - Replace them with grounded, concrete technical or domain facts (e.g., `"Singer Auto bay reference · 283 V8"`, `"Read the book before turning a wrench."`).
- **Banned Patronizing / Obvious Microcopy**:
  - Do not narrate obvious UI mechanics or background telemetry (e.g., `"Clicking this button will send a request and record your click"`, `"A little context"`, `"In your garage"`). State the domain purpose or omit the hint altogether.
- **Placeholder Filtering**:
  - When upstream sync records contain placeholder strings such as `"Fake summary"`, suppress the placeholder rather than rendering literal `"Fake summary"` text in the UI.

### 3. Domain Identity Rules
- **Main Farm Domain (`app-farm`)**:
  - Browser tab title is strictly `Elder Vibe Coder` (never `Farm · Elder Vibe Coder`).
  - `#cases` (*Case files* / *Hồ sơ vụ việc*) uses a responsive investigative/police case-file register (`table.table--stack.case-table`) with semantic icons (`Fingerprint`, `Siren`, `Footprints`, `ShieldCheck`, `Search`, `FileBadge`) rather than generic project cards.
- **30s / Car 3D Models (`app-car-3d-models`)**:
  - Uses the **Bobby Singer (`Singer Auto`)** salvage-yard & shop-desk concept (*Supernatural* Sioux Falls yard): practical, mechanical, book-first verification before turning a wrench (`SINGER AUTO · SALVAGE & FIELD DESK`, `SINGER AUTO BAY`, `SINGER AUTO · SIOUX FALLS YARD`).
