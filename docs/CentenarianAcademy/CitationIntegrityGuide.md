# Citation Integrity Guide (handling bad citations and sources)

This is the standard for sources and citations in any Centenarian Academy course. Hand it to
the AI building a course. It exists because AI-drafted source material routinely contains
fabricated studies, mis-attributed authors, and inflated statistics. The job is to ship a
course where every claim is backed by a real source a reader can open, and nothing else.

Pair it with `CourseAuthoringGuide.md` (craft) and `CourseProductionPlaybook.md` (process).

---

## The one rule

Never attach a citation to a claim it does not support, and never invent a study, author,
year, or statistic. If a claim has no verifiable source, soften it to an honest general
statement with no citation, or cut it. A vague true sentence beats a precise fake one.

---

## Ready-to-paste instruction for your AI

Copy this into the prompt you give the course-writing AI.

```
Treat every citation in the source material as UNVERIFIED until you check it. Source drafts
(especially AI-generated ones) often contain fabricated studies, the wrong author on a real
study, or invented statistics.

For every factual claim you cite:
1. Resolve the citation against Crossref by title, author, and year. Real papers return a DOI
   and matching metadata.
2. Check the FIRST AUTHOR and YEAR against what the draft claims. A mismatch means the draft
   pinned a real finding on the wrong paper. Use the correct author and year.
3. Confirm the paper actually reports the claim (read the abstract), not just that it exists.
   Papers get cited for numbers they never reported.
4. Use ONLY a verified in-text citation, with the exact author and year the record shows.
5. If a claim has no verifiable source: rephrase it to a general, honest statement with NO
   citation, and add it to a flags list. Do not attach a real citation to a claim it does not
   support. Do not state a precise statistic you cannot source.
6. For each flagged claim, hunt for a real source. If one exists, cite it correctly. If none
   exists, leave the claim general or cut it.

Never fabricate a DOI, an author, a year, a journal, or a statistic.
```

---

## How to verify (the tools)

All free, no key needed.

- **Crossref** (does the paper exist, what is its real metadata):
  - By DOI: `https://api.crossref.org/works/{DOI}?mailto=you@example.com`
  - By description: `https://api.crossref.org/works?rows=5&query.bibliographic={title+authors+year}`
  - Match on year and first-author surname. Low confidence means look closer.
- **Unpaywall** (is there a free PDF): `https://api.unpaywall.org/v2/{DOI}?email=you@example.com`
  then read `best_oa_location.url_for_pdf`.
- **PubMed Central** for open-access full text when Unpaywall has no direct PDF:
  ID convert `https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?ids={DOI}&format=json`, then
  the PMC article page. Throttle to under 3 requests a second without an API key.
- **PubMed abstract** for the supporting text:
  `efetch.fcgi?db=pubmed&id={PMID}&rettype=abstract&retmode=text`.

Download the open-access PDFs so the sources are reviewable, not just linked.

---

## Classify every failure

| Type | What it looks like | What to do |
|---|---|---|
| Fabricated | No paper matches the description at all. | Cut the claim. |
| Mis-attributed | Real paper, wrong first author or year in the draft. | Correct the author and year. |
| Overstated | Real paper, but the cited number is inflated or not in it. | Use the real finding, or state direction only. |
| Pop-sci as science | A trade book or blog dressed up as a peer-reviewed study. | Keep the idea general, or find a real study. |

Real examples caught on the "Read Your Body's Data" build: a "New England Journal of Medicine
study of 100,000 people" that does not exist (cut); a "32%/45%/28%/23%" outcomes cluster with
no source (cut); "Cadilhac 2022" that is really Germini 2022 (corrected); "Mason 2020" that is
really Quer 2020 (corrected); a "50% mortality reduction" softened to "substantially lower"
because the cited study does not support the exact figure.

---

## The artifacts to produce (per course)

Ship these so the work is checkable:

1. **Master source and usage map**: every verified source with its APA reference, a link, the
   downloaded PDF, and which lessons cite it.
2. **Teacher evidence ledger** (in the course `teacher/` folder): each cited claim, the
   source's own abstract as evidence, and the exact lesson where it is used. A prospective
   teacher reads this to vet the course before agreeing to teach it.
3. **Sources still needed**: a clear list of claims that have no verified source yet, with
   search hints, so a human can hunt for them.
4. **Fake claims audit**: what was wrong in the drafts and how you caught it. This doubles as
   honest marketing: we check our work.

---

## Quick checklist

- [ ] Every in-text citation resolves to a real DOI.
- [ ] First author and year match the real record.
- [ ] The source actually reports the claim (abstract checked).
- [ ] No fabricated study, author, year, journal, or statistic anywhere.
- [ ] Unsourced claims are general (no citation) and listed in "sources still needed."
- [ ] Open-access PDFs downloaded; the four artifacts produced.
- [ ] No em-dashes, no en-dashes, no rare-word filler (this doc models that).

---

## Reference implementation

The "Read Your Body's Data" course built all of this:
`docs/CentOS Courses/FDA and Metrics CentOS version/`: see `Course Sources - Master
Reference and Usage Map.md`, `Fake Claims Audit and Content Ideas.md`, `Sources Still Needed -
Search List.md`, `academy-import/teacher/Teacher Evidence Ledger - Verify Before You Teach.md`,
and the scripts `_resolve-sources.mjs`, `_hunt-sources.mjs`, `_build-apa.mjs`,
`_fetch-abstracts.mjs`, `_build-teacher-ledger.mjs`.
