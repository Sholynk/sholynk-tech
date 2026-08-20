# Sholynk Style Reference: The ThoughtCo Model

**What this document is.** The editorial model for every article on Sholynk Tech,
codified from the reference article the author selected: *"What Is the Contact
Hypothesis in Psychology?"* by Elizabeth Hopper on ThoughtCo
(https://www.thoughtco.com/contact-hypothesis-4772161, studied 20 August 2026).

This reference supersedes the earlier voice-pass approach, which was reverted.

Companion documents: `docs/AUTHOR_PUBLISHING_GUIDE.md` (layout slots and house
rules), `article_stories/README.md` (mechanics).

---

## 1. The model in one sentence

Write like an excellent encyclopaedia entry or a patient lecturer: define the
subject in one sentence, teach it in logical order, attribute every claim to a
named source, and evaluate it with balance. Never dramatise, never address the
reader, never editorialise.

## 2. Structure template (top to bottom)

1. **Declarative title.** The title keeps the site's established format (a clear
   statement of the subject, e.g. "The Rise of Quantum Computing: The Computing
   Revolution Beyond Silicon"). Question-form titles are optional, not required.
2. **Question-form standfirst** (`hook`). One sentence reframing the topic as a
   curiosity question: "Can getting to know members of other groups reduce
   prejudice?"
3. **One-sentence opening definition.** The body begins with a plain definition
   of the subject. No scene, no anecdote, no suspense. The `directAnswer` box
   carries this definition and must stand alone.
4. **Key takeaways** (`keyTakeaways`). Three to six short, factual,
   self-contained statements. Facts, not aphorisms.
5. **Body sections in teaching order**, with declarative `##` headings in the
   established Sholynk format (Introduction, Understanding X, Why It Matters,
   Real-World Applications, Benefits and Opportunities, Limitations, Risks and
   Trade-offs, Conclusion). Question-form headings are optional and used only
   where they genuinely help:
   - Introduction: definition plus scope; why the subject warrants examination.
   - Historical Background: origins, named early work, the puzzle that produced
     the idea.
   - Core explanation: what the thing is and how it works; terminology defined
     inline at first use.
   - Applications / where it shows up: concrete, evidenced uses.
   - Evaluating the evidence: what research has found, including scale
     ("over 500 studies, approximately 250,000 participants") and alternative
     explanations considered and addressed.
   - Limitations and open problems: when it fails or backfires; newer research
     directions.
   - Conclusion: a balanced synthesis. Both support and criticism in one
     measured paragraph.
6. **Sources** (`sources`). Every claim in the body is backed by a record here,
   and attributed inline next to the claim.
7. **Related reading** (`relatedSlugs`).

## 3. Register rules

- **Impersonal third person throughout.** No "I" anywhere. No "you" anywhere.
  The author never steps into the text.
- **Plain, unhurried sentences.** Medium length, one idea per sentence,
  subject–verb–object. No rhetorical flourishes, no antithetical punchlines,
  no dramatic staging, no wit at the reader's expense.
- **Hedged precision.** "suggests", "may", "is most likely to", "in some
  instances", "is not a panacea". Nothing is overstated.
- **Attribution is the texture.** Nearly every paragraph carries a named
  researcher, organisation or publication plus a year, hyperlinked to the
  source.
- **Declarative headings by default**, in the established Sholynk format; a
  question heading only where it genuinely helps.
- **Terms defined at first use.** Key terms are bolded on first appearance and
  explained immediately.
- **Short quotes only**, used when the original wording carries weight.
- **Dialectical balance.** Theory, evidence, mechanisms, limitations and new
  directions all appear where the subject has them.
- **Complete but concise.** Answer the question fully; no padding.

## 4. Banned patterns (what the reference never does)

- Narrative or scenic openings ("You picked up your phone...", "In August 2024
  the United States finalised...").
- Second-person address ("you will rarely...", "watch for these patterns").
- Aphoristic verdict sentences ("Frameworks are rented. Fundamentals are
  owned.").
- Dramatic staging ("Here is the part popular explanations get wrong",
  "Read that again").
- Editorialising asides and witty digressions.
- Marketing register of any kind (already a house rule).

## 5. Mapping to Sholynk page slots

| ThoughtCo element | Sholynk slot |
| --- | --- |
| Declarative title | `title` (under 70 characters) |
| Question-form standfirst | `hook` |
| Opening definition | `directAnswer` (Quick answer box) |
| Key takeaways bullets | `keyTakeaways` |
| Teaching-order sections | `##` body headings (auto-TOC, minimum three) |
| Inline citations | body links + `sources` records |
| Sources and Additional Reading | rendered Sources section |
| Related articles | `relatedSlugs` grid |

## 6. Standing house rules that override the reference

The reference article uses some conventions the site does not allow. Where they
conflict, the house rule wins:

- **Strictly British English** (ThoughtCo is American).
- **No em dashes between words.** Use commas, semicolons or full stops
  (ThoughtCo uses em dashes freely).
- Front-matter mechanics unchanged: one line per field, single-line JSON arrays,
  front matter first in file.
- Body at least 300 words; slugs permanent; dates accurate; sources real and
  each one `supports` a named claim.

## 7. Pre-publication checklist

- [ ] Title is a clear declarative statement of the subject (under 70
      characters).
- [ ] `hook` is a one-sentence curiosity question.
- [ ] The body opens with a plain definition; `directAnswer` stands alone.
- [ ] Key takeaways are short factual statements, not aphorisms.
- [ ] Sections follow the teaching order, with declarative headings in the
      established Sholynk format.
- [ ] Every claim carries inline attribution (name + year + link) and a
      matching `sources` record.
- [ ] Key terms defined at first use.
- [ ] Limitations and counter-evidence are discussed.
- [ ] The conclusion is a balanced synthesis, not a summary.
- [ ] No "I", no "you", no scenes, no punchlines, no staging.
- [ ] Strictly British English; no em dashes; all slots and links intact.
