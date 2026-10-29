# My Barber Shipped While I Debated Architecture

## Agentic AI in minutes with Firebase

Markdown content brief for a future deck. Audience: technical developers. Duration target: **20 minutes including a six-minute demo, excluding Q&A**. Implementation is deployed; one scoped browser rehearsal passed in 5:23 and the second exposed a real RAG timeout. [Three genuine offline fallback images](implementation/demo-rehearsal-2026-10-25.md#genuine-offline-fallback) are available. Two successful full repetitions, presenter narration and the full talk timing remain unverified. The slide schedule below is planned, not measured elapsed time. See the [acceptance index](implementation/acceptance-coverage.md).

## Editorial direction

The audience should leave willing to try one small business workflow with managed tools. Use the real **Not Bad Stuff** brand and salons **Legnicka, Łódzka and Zakładowa**, as confirmed by the presenter. The [catalog](04-not-bad-stuff-catalog.md) contains real products; stock levels and internal policies are demo fixtures.

The technical takeaway is the boundary between language interpretation, retrieved evidence and reliable application actions.

Use the friend's real story with permission and accurate attribution. BarberHQ is the proposed conference demo inspired by his business; do not imply he already built it using this stack. Keep architecture to one slide and source code to one optional example. Avoid invented before/after savings or claiming the whole production system was built in minutes.

Visual direction: warm barbershop imagery, cream/charcoal, one bright accent for actions. Emphasize jars, messages and decisions before cloud-service logos. Show large numbers during the demo. Avoid dashboard screenshots too dense to read from the back row.

## Running order

| Slide | Time | Duration | Purpose |
|---|---|---:|---|
| 1. My barber shipped | 00:00–01:30 | 1:30 | Personal hook |
| 2. The problem between appointments | 01:30–03:00 | 1:30 | Business context |
| 3. Two useful outcomes | 03:00–04:00 | 1:00 | Define success |
| 4. Live: replenish two units, then find damage instructions | 04:00–10:00 | 6:00 | Demonstrate the full workflow |
| 5. Where the AI helped | 10:00–12:00 | 2:00 | Explain RAG and agentic behavior |
| 6. The smallest useful stack | 12:00–13:30 | 1:30 | Map managed services to jobs |
| 7. From domain knowledge to a slice | 13:30–15:30 | 2:00 | Encourage experimentation |
| 8. When the demo becomes tomorrow's dependency | 15:30–17:30 | 2:00 | Operating responsibilities |
| 9. Measure the workflow | 17:30–19:00 | 1:30 | Business-aware engineering |
| 10. Start with one recurring frustration | 19:00–20:00 | 1:00 | Concrete call to action |

If Q&A is included in the 20 minutes, shorten slide 7 by one minute and slide 9 by one minute. Do not squeeze the approval and evidence moments out of the demo.

---

## Slide 1 — My barber shipped

**On screen**

My Barber Shipped While I Debated Architecture

Agentic AI in minutes with Firebase

**Visual**

A barbershop/product image next to a small unfinished architecture sketch. Use a licensed or owner-approved image; no asset generation is required now.

**Speaker notes**

“When I start a side project, I often begin by choosing something I want to learn. Then I build a structure around it. My friend starts with something that wastes his time at work. He knows what a useful result looks like.”

Tell one verified example of a tool the friend actually built. State that today's demo explores a related workflow with Angular and Firebase. The story is about learning from domain expertise, not dismissing engineering.

**Transition**

“What does a useful result look like in his business?”

## Slide 2 — The problem between appointments

**On screen**

“We're running low on the matte stuff. Can you send more?”

Salon → HQ → dispatch → receipt

Separate question: “A product arrived damaged. What should we do?”

**Visual**

Two scenes: a stock request moving from salon to warehouse and back; a staff member finding the procedure for a separate damaged delivery.

**Speaker notes**

The message is easy for a colleague to understand but incomplete for a system: product, quantity, stock, policy and timing. Each handoff can create a question. The owner also has packing problems, but this demo follows replenishment to receipt, then shows a separate procedure question.

Describe communication overhead as a hypothesis to validate; do not assign minutes or money without a baseline.

## Slide 3 — Two useful outcomes

**On screen**

Replenishment: requested 2 / received 2.

Damaged delivery: find the relevant instructions and their source.

**Visual**

Two lanes: request → approve → dispatch → receive; question → retrieve procedure → cited answer.

**Speaker notes**

“The first workflow moves stock with explicit confirmations. The second helps staff find what to do. They share an app but remain separate examples.”

Explain that products and salon names are real; inventory and internal procedures are synthetic demo data because real documents were unavailable.

## Slide 4 — Live: replenish two units, then find damage instructions

**On screen before switching to app**

Legnicka: two Pomada Matowa units.

Zakładowa: a separate damaged-delivery question.

**Demo beats — six minutes total**

1. Show initial stock: HQ 18, Legnicka 2.
2. Request two units; show catalog and stock tools.
3. HQ approves and confirms dispatch; HQ on hand becomes 16.
4. Legnicka confirms intact receipt; salon on hand becomes 4. Requested/dispatched/received all equal 2.
5. Switch to the separate procedure assistant. Ask what to do about a cracked product delivered to Zakładowa.
6. Show retrieved instructions and open their source sections and the original PDF with the cited passage highlighted, visibly labeled synthetic.
7. Confirm that asking for guidance changed no stock and sent no report.

**Speaker notes**

“Application actions make the stock movements exact. RAG helps us find operating knowledge when the next question is about a procedure.”

Follow the [runbook](03-demo-runbook.md): target 3:45 replenishment, 1:45 knowledge assistance, 0:30 wrap-up. Physical movement is simulated with explicit confirmations. Use a clearly labeled verified offline fallback if available; otherwise explain the unavailable path. No recording is currently promised.

## Slide 5 — Where the AI helped

**On screen**

| Need | Mechanism |
|---|---|
| Understand the message | Gemini |
| Find damaged-delivery instructions | Retrieve → provide context → explain |
| Choose what to look up next | Bounded tool use |
| Reserve, dispatch and receive stock | Application code + database |

**Visual**

Show two lanes: stock tools and confirmed movements; procedure retrieval and cited answer. No embedding math.

**Speaker notes**

“RAG means we find relevant pieces of our own documents and give them to the model with the question. Agentic behavior means the model can choose from tools to gather what it needs. Here it has a small set of tools and a clear stopping point.”

“The citation lets us inspect the evidence. It doesn't guarantee the explanation is correct. We still validate outputs and test examples.”

Real internal documents were unavailable, so we authored the small synthetic pack transparently. It illustrates how retrieval can serve a larger handbook; it does not prove quality on the real documents. Be candid: a tiny handbook can fit in a prompt. Retrieval demonstrates a useful pattern; it is not a prerequisite for every prototype. Genkit provides tool calling; the application chooses its limits. [Genkit tool calling](https://genkit.dev/docs/js/tool-calling/)

## Slide 6 — The smallest useful stack

**On screen**

Angular → Firebase → a useful workflow

- Auth: who is acting?
- SQL Connect / PostgreSQL: what is true?
- pgvector: which policy is relevant?
- Genkit + Gemini: what should we look up and explain?
- Functions + Hosting: run and deliver the app.

**Visual**

Use the architecture diagram from the [research](01-research-and-recommendation.md), simplified to five boxes. Highlight the separate approval path.

**Speaker notes**

“SQL Connect was previously called Data Connect. It gives us deployed data operations and generated SDKs. Its PostgreSQL vector support means this example can keep policy retrieval and business data in one database.” [Generated web SDKs](https://firebase.google.com/docs/sql-connect/web-sdk), [SQL vector search](https://firebase.google.com/docs/sql-connect/solutions-vector-similarity-search)

Firestore vector search is a valid alternative; do not introduce it as an additional component in this demo. Angular is a SPA on Hosting; explain App Hosting only if asked.

## Slide 7 — From domain knowledge to a slice

**On screen**

Describe one real task.

Provide one real example.

Build one complete path.

Let the person who does the job try it.

**Visual**

Example request → rules supplied by owner → first usable screen → correction from owner.

**Speaker notes**

Offer a starter brief: “Our salon managers message HQ for cosmetics. Turn one message into a replenishment proposal. Show the product, available stock and requested quantity. Require explicit approval, dispatch and receipt confirmations. Use sample data first.”

Then explain the domain details a code generator cannot invent responsibly: jars versus packs, stock freshness, substitutes and who can approve. These details determine whether the app helps.

The approved UI supports a shared multi-product draft submitted as one atomic request, low-stock indicators and an HQ-managed PDF library. Keep the two-unit stock proof and independent damaged-delivery question as the stage narrative. Distinguish already recorded feature evidence from the still-pending final timed rehearsal.

If implementation timing was recorded, show the actual timeline with its scope. Otherwise say that fast experimentation is the ambition and omit numerical build-time claims. No live scaffolding is planned.

## Slide 8 — When the demo becomes tomorrow's dependency

**On screen**

| What changes | Engineering response |
|---|---|
| Two people approve the last two units | Conditional writes, transactions, retry safety |
| The model or network fails | Bounded calls and manual entry |
| Policies and staff change | Versioned evidence and access checks |
| More requests arrive | Measure latency, quality and cost |

**Speaker notes**

“Scale starts when someone depends on this every day. It doesn't have to mean a million users. A duplicated reservation matters even in three salons.”

Talk about observing the workflow and owning failures. Mention the SQL instance, model calls and embedding costs; budgets notify rather than cap spending. [SQL Connect pricing](https://firebase.google.com/docs/sql-connect/pricing)

Managed infrastructure removes work, but the application still owns its business invariants. Tests should prove the last-units race and safe retries, not merely that the model returns fluent text.

## Slide 9 — Measure the workflow

**On screen**

Did the salon receive what it requested? Could staff find the right procedure?

- Requested versus received units
- Time to completed replenishment
- Follow-up messages
- Corrections needed
- Stock consistency
- Time to locate the correct instructions

**Visual**

An empty baseline/assisted measurement card marked “Pilot measurements.” Replace it with real measurements only if available.

**Speaker notes**

“A completed implementation ticket doesn't tell us whether this helped the salon. We need to observe the work before and after, and ask the person doing it.”

Recognize that a form could outperform chat for frequent, structured requests. Preserve manual entry and let actual usage decide. Packaging becomes the next experiment only if it solves the next important problem.

## Slide 10 — Start with one recurring frustration

**On screen**

Ask someone: “What do you keep doing manually?”

Build one useful path. Test it with them.

Domain knowledge gets a product started.

Engineering keeps it dependable.

**Speaker notes**

“You don't need to decide the final architecture to learn whether a workflow is useful. You do need to understand the work. Start small enough to learn quickly, then apply engineering effort where real use shows it matters.”

Add a repository/QR link only after a shareable repository exists. Close on the business outcome rather than a list of technologies.

## Optional backup slides — outside the 20 minutes

- **Why not Firestore?** Valid alternative; SQL chosen to match relational stock data and the promised abstract.
- **Why RAG for a small synthetic corpus?** Teaching scope; compare against full-context prompting before expanding.
- **Why no autonomous shipping?** Staff confirm dispatch/receipt; carrier integration is another workflow.
- **Where is the code?** One tool definition, one source card and one guarded mutation, taken from the eventual implementation.
- **What does this cost?** Show actual rehearsal usage and selected infrastructure prices, dated and scoped.
