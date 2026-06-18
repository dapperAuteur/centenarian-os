// scripts/ces-build-manifest.mjs
// Builds docs/ces-curriculum/source/lesson-manifest.json: the authoritative list of
// prose lessons to author (content + review + exam-walkthrough), each with a one-concept
// brief, source file(s), free flag, module info, and the previous-lesson title for the
// recall opener. Quizzes are built separately. Run: node scripts/ces-build-manifest.mjs

import fs from 'fs';
import path from 'path';

const SRC = 'docs/ces-curriculum/source';
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// content lessons: [n, title, brief, [sourceFiles]]
const M = [
  { mod: 0, title: 'Module 0: Orientation and How to Pass the CES Exam', free: true, review: false, exam: false, content: [
    [1, 'What a Corrective Exercise Specialist Does', 'Define the CES role: finding why a body moves poorly and fixing it. Who this course is for (trainers, coaches, health pros) and the longevity payoff of good movement.', ['ch01-l1.md']],
    [2, 'Inside the NASM CES Exam', 'How the exam works: it is a third-party study companion, not the official cert. Format, the kinds of domains it tests, how to schedule, and how to study. Do not state an exam-weight percent unless verified.', []],
    [3, 'The Corrective Exercise Continuum in One Picture', 'The spine of the whole cert: inhibit, lengthen, activate, integrate. What each step does in one line, in order. This is the mental model everything hangs on.', ['ch03-l1.md', 'ch04-l1.md', 'ch05-l1.md', 'ch06-l1.md']],
    [4, 'How to Study With This Course', 'Audio-first habit, the recall openers, why quizzes beat rereading, and how to use the cheat sheets and glossary. Set the study routine.', []],
  ] },
  { mod: 1, title: 'Module 1: Rationale for Corrective Exercise', free: false, content: [
    [1, 'Why Corrective Exercise Matters', 'The movement-impairment problem: sitting, repetition, and injury change how people move, and bad movement compounds over years. Set the stakes.', ['ch01-l1.md', 'ch01-l2.md']],
    [2, 'The Rationale and Benefits', 'The case for corrective exercise: fewer injuries, better movement quality, and a bridge between rehab and performance.', ['ch01-l2.md']],
    [3, 'Professional Scope of the CES', 'What a CES can and cannot do, the line with medical and rehab pros, and when to refer out.', ['ch01-l3.md']],
  ] },
  { mod: 2, title: 'Module 2: Human Movement Science', free: false, content: [
    [1, 'Planes, Axes, and Joint Motions', 'The three planes (sagittal, frontal, transverse), the motions in each, and why a CES thinks in planes.', ['ch02-l1.md']],
    [2, 'Muscles as Movers and Teams', 'Agonist, antagonist, synergist, stabilizer, and force-couples: how muscles share work to make movement.', ['ch02-l1.md']],
    [3, 'The Muscles a CES Watches Most', 'A working reference for the key muscles in corrective work: where they are and what they do, in plain terms.', ['ch02-l1.md']],
    [4, 'Motor Behavior: Control, Learning, and Feedback', 'Motor control, learning, and development, and how internal and external feedback builds better movement patterns.', ['ch02-l2.md']],
    [5, 'The Length-Tension Relationship', 'A muscle makes its best force at the right length; too short or too long and force drops. Why resting length matters.', ['ch02-l3.md']],
    [6, 'Force-Velocity and Force-Couples in Action', 'How speed changes force, and how force-couples steer a joint. Tie it back to movement quality.', ['ch02-l3.md']],
    [7, 'The Movement and Stabilization Systems', 'Local (stabilizing) vs global (moving) muscle systems and why both must work for safe movement.', ['ch02-l4.md']],
    [8, 'How Movement Impairment Starts', 'Altered reciprocal inhibition, synergistic dominance, and the cumulative injury cycle: the chain that turns a small problem into a pattern.', ['ch02-l5.md']],
  ] },
  { mod: 3, title: 'Module 3: Inhibitory Techniques', free: false, content: [
    [1, 'Inhibition and Self-Myofascial Techniques', 'Step one of the continuum: calming an overactive muscle with self-myofascial rolling (SMR). What it is and what it targets.', ['ch03-l1.md']],
    [2, 'How to Apply Self-Myofascial Techniques', 'Application guidelines: where to roll, how long, pressure, and when to hold a tender spot.', ['ch03-l2.md']],
    [3, 'Vibration and Whole-Body Vibration', 'How vibration tools and whole-body vibration fit inhibition, and what the evidence supports.', ['ch03-l3.md']],
    [4, 'Key Points for Practical Application', 'The practical playbook for inhibition: reduce tension first, then add movement. Common mistakes.', ['ch03-l4.md']],
  ] },
  { mod: 4, title: 'Module 4: Lengthening Techniques', free: false, content: [
    [1, 'What Lengthening Is', 'Step two of the continuum: restoring length to a short muscle. The family of stretching tools at a glance.', ['ch04-l1.md']],
    [2, 'The Scientific Rationale for Stretching', 'Why stretching works: tissue and neural changes, acute vs lasting effects, and what to expect.', ['ch04-l2.md']],
    [3, 'Applying Static, Neuromuscular, and Dynamic Stretching', 'When and how to use static, neuromuscular (PNF-style), and dynamic stretching, with hold times and cues.', ['ch04-l3.md']],
  ] },
  { mod: 5, title: 'Module 5: Activation Techniques', free: false, content: [
    [1, 'What Activation Is', 'Step three of the continuum: waking up an underactive muscle with isolated strengthening. The goal and the tools.', ['ch05-l1.md']],
    [2, 'How to Apply Isolated Strengthening', 'Application guidelines: tempo, reps, and the precautions and contraindications that matter.', ['ch05-l2.md']],
    [3, 'Isolated Strengthening Exercises', 'Common positional isometrics and isolated exercises a CES uses, and how to coach them.', ['ch05-l3.md']],
  ] },
  { mod: 6, title: 'Module 6: Integration Techniques', free: false, content: [
    [1, 'What Integration Is', 'Step four of the continuum: retraining the whole chain to move well together with integrated dynamic movement.', ['ch06-l1.md']],
    [2, 'How to Apply Integration Techniques', 'Application guidelines for integration: progressions, tempo, and precautions.', ['ch06-l2.md']],
  ] },
  { mod: 7, title: 'Module 7: Client Intake and Assessment', free: false, content: [
    [1, 'The Intake and Assessment Overview', 'Why assessment comes before programming, and the flow from intake to a corrective plan.', ['ch07-l1.md']],
    [2, 'The Client Intake Screen', 'The PAR-Q, health, lifestyle, and medical history, and the red flags that change your plan.', ['ch07-l2.md']],
    [3, 'Ethical and Legal Considerations', 'Scope of practice, consent, privacy, and the legal lines a CES stays inside.', ['ch07-l3.md']],
  ] },
  { mod: 8, title: 'Module 8: Static Assessments', free: false, content: [
    [1, 'What Static Posture Tells You', 'Reading a still body: landmarks, plumb line, and what posture hints at.', ['ch08-l1.md']],
    [2, 'A Systematic Approach to Static Posture', 'The step-by-step way to assess static posture from each view, so you do not miss anything.', ['ch08-l2.md']],
    [3, 'Common Postural Distortion Patterns', "Janda's syndromes and the classic distortion patterns, with what is short and what is long in each.", ['ch08-l3.md']],
  ] },
  { mod: 9, title: 'Module 9: Movement Assessments', free: false, content: [
    [1, 'The Overview of Movement Assessment', 'Why moving assessments reveal more than still ones, and how they fit the assessment flow.', ['ch09-l1.md']],
    [2, 'Transitional Movement Assessments', 'The overhead squat, single-leg squat, and pushing and pulling assessments: what to watch and what compensations mean.', ['ch09-l2.md']],
    [3, 'Loaded Movement Assessments', 'Adding load to expose patterns, and how to read the results safely.', ['ch09-l3.md']],
    [4, 'Dynamic Movement Assessments and Gait', 'Assessing movement in motion, including gait, and what the walk tells you.', ['ch09-l4.md']],
  ] },
  { mod: 10, title: 'Module 10: Mobility Assessments', free: false, content: [
    [1, 'What Mobility Assessment Adds', 'Range of motion, goniometry, and special tests: pinning down where mobility is limited.', ['ch10-l1.md']],
    [2, 'Mobility Assessment Procedures by Region', 'The region-by-region mobility tests and how to interpret each result.', ['ch10-l2.md']],
  ] },
  { mod: 11, title: 'Module 11: Corrective Strategies: Foot and Ankle', free: false, content: [
    [1, 'Foot and Ankle: Anatomy and Common Dysfunction', 'The foot and ankle a CES sees most, and the dysfunctions that start here and travel up the chain.', ['ch11-l1.md']],
    [2, 'Reading Foot and Ankle Assessment Results', 'Turning assessment findings for the foot and ankle into a clear picture of what is over- and underactive.', ['ch11-l2.md']],
    [3, 'The Four-Phase Corrective Strategy', 'Building the foot and ankle program: inhibit, lengthen, activate, integrate, with real selections.', ['ch11-l3.md']],
    [4, 'Common Foot and Ankle Issues', 'Plantar fasciitis and ankle sprain: what is going on and how the corrective plan changes.', ['ch11-l4.md']],
  ] },
  { mod: 12, title: 'Module 12: Corrective Strategies: Knee', free: false, content: [
    [1, 'Knee Dysfunction and Regional Interdependence', 'Why the knee is often a victim of the hip and ankle, and the regional interdependence model.', ['ch12-l1.md']],
    [2, 'Reading Knee Assessment Results', 'Interpreting knee findings (knees bow in or out) and what drives them.', ['ch12-l2.md']],
    [3, 'The Corrective Strategy for the Knee', 'The four-phase knee program with real exercise selections.', ['ch12-l3.md']],
    [4, 'Common Knee Issues', 'Patellofemoral pain and similar issues, and how the plan adapts.', ['ch12-l4.md']],
  ] },
  { mod: 13, title: 'Module 13: Corrective Strategies: LPHC', free: false, content: [
    [1, 'The LPHC: Anatomy and Common Dysfunction', 'The lumbo-pelvic-hip complex as the body center, and the dysfunctions that ripple out from it.', ['ch13-l1.md']],
    [2, 'Reading LPHC Assessment Results', 'Interpreting low-back and hip findings (excessive arch, forward lean) and their causes.', ['ch13-l2.md']],
    [3, 'Common Exercise Selections for the LPHC', 'The four-phase LPHC program with the go-to selections.', ['ch13-l3.md']],
    [4, 'Low-Back Pain and the LPHC', 'How corrective exercise fits non-acute low-back pain, and the scope limits.', ['ch13-l4.md']],
  ] },
  { mod: 14, title: 'Module 14: Corrective Strategies: Thoracic Spine and Shoulder', free: false, content: [
    [1, 'Shoulder and Thoracic Spine: Anatomy and Dysfunction', 'The shoulder complex and upper back, and the rounded-shoulder, forward-head patterns a CES sees.', ['ch14-l1.md']],
    [2, 'Reading Shoulder and Thoracic Assessment Results', 'Interpreting arms-fall-forward and shoulder elevation findings.', ['ch14-l2.md']],
    [3, 'Exercise Selections for the Thoracic Spine and Shoulder', 'The four-phase upper-body program with selections.', ['ch14-l3.md']],
    [4, 'Common Shoulder and Thoracic Issues', 'Impingement and similar issues, and how the plan changes.', ['ch14-l4.md']],
  ] },
  { mod: 15, title: 'Module 15: Corrective Strategies: Wrist and Elbow', free: false, content: [
    [1, 'Elbow and Wrist: Anatomy and Dysfunction', 'The elbow and wrist, and the grip- and posture-driven problems that show up here.', ['ch15-l1.md']],
    [2, 'Reading Elbow and Wrist Assessment Results', 'Interpreting findings at the elbow and wrist.', ['ch15-l2.md']],
    [3, 'Corrective Strategies for the Elbow and Wrist', 'The four-phase program and exercise selections for the elbow and wrist.', ['ch15-l3.md']],
    [4, 'Common Elbow, Wrist, and Hand Issues', 'Tennis and golfer elbow, carpal tunnel, and how corrective work helps.', ['ch15-l4.md']],
  ] },
  { mod: 16, title: 'Module 16: Corrective Strategies: Cervical Spine', free: false, content: [
    [1, 'The Cervical Spine: Anatomy and Dysfunction', 'The neck and the forward-head pattern, and why the neck and upper back work together.', ['ch16-l1.md']],
    [2, 'Reading Cervical Assessment Results', 'Interpreting forward-head and neck findings.', ['ch16-l2.md']],
    [3, 'Exercise Selections for the Cervical Spine', 'The four-phase neck program and the safe selections.', ['ch16-l3.md']],
    [4, 'Common Cervical Spine Issues', 'Neck pain and headaches tied to posture, and the scope limits.', ['ch16-l4.md']],
  ] },
  { mod: 17, title: 'Module 17: Self-Care and Recovery', free: false, content: [
    [1, 'Self-Care and Recovery Foundations', 'Why recovery is part of the plan, and what self-care means for a CES and their clients.', ['ch17-l1.md']],
    [2, 'Recovery Planning', 'Building recovery into a program: sleep, load management, and rest.', ['ch17-l2.md']],
    [3, 'Recovery Strategies, Tools, and Methods', 'The recovery tools a CES can recommend and what the evidence says.', ['ch17-l3.md']],
    [4, 'Communication Skills for Adherence', 'Coaching that gets clients to actually do the work, and how to talk so people stick.', ['ch17-l4.md']],
  ] },
  { mod: 18, title: 'Module 18: Real-World Application', free: false, content: [
    [1, 'Real-World Application of Corrective Exercise', 'Putting the whole system together for a real client, start to finish.', ['ch18-l1.md']],
    [2, 'Programming When Compensations Are Present', 'How to adjust the plan when a client shows multiple or stubborn compensations.', ['ch18-l2.md']],
  ] },
  { mod: 19, title: 'Module 19: Capstone and Practice Exam', free: false, review: false, exam: false, content: [
    [1, 'Exam-Day Strategy', 'Timing, how NASM writes questions, how to spot trap answers, and a calm test-day plan.', []],
  ] },
];

// generate flat list with review + exam-walkthrough, compute prevTitle
const lessons = [];
let prevTitle = null;
for (const m of M) {
  const addReview = m.review !== false;
  const addExam = m.exam !== false;
  for (const [n, title, brief, src] of m.content) {
    lessons.push({ module: m.mod, moduleTitle: m.title, free: !!m.free, type: 'content', n, title, brief,
      sourceFiles: src.map((f) => `${SRC}/${f}`), refFile: m.mod >= 1 && m.mod <= 18 ? `${SRC}/ch${String(m.mod).padStart(2, '0')}-references.md` : null,
      prevTitle, slug: slug(title) });
    prevTitle = title;
  }
  if (addReview) {
    const n = m.content.length + 1;
    const title = `${m.title.replace(/^Module \d+: /, '')}: Cumulative Review`;
    lessons.push({ module: m.mod, moduleTitle: m.title, free: !!m.free, type: 'review', n, title,
      brief: `A cumulative review of this module: 5 to 8 top facts, plus one callback to each earlier module. Audio-first, like every lesson.`,
      sourceFiles: [], refFile: null, prevTitle, slug: slug(title) });
    prevTitle = title;
  }
  if (addExam) {
    const n = m.content.length + 2;
    const title = `${m.title.replace(/^Module \d+: /, '')}: How the Exam Tests This`;
    lessons.push({ module: m.mod, moduleTitle: m.title, free: !!m.free, type: 'exam-walkthrough', n, title,
      brief: `A short walkthrough of how the NASM CES exam asks about this module's topics: the wording patterns and the common trap answers. Leads into the module quiz.`,
      sourceFiles: [], refFile: null, prevTitle, slug: slug(title) });
    prevTitle = title;
  }
}

const out = { course: 'NASM CES Accelerator', voiceTemplate: 'docs/ces-curriculum/_VOICE-AND-TEMPLATE-CES.md',
  bibliography: 'docs/CentenarianAcademy/shared-sources/bibliography.json', count: lessons.length, lessons };
fs.mkdirSync(SRC, { recursive: true });
fs.writeFileSync(path.join(SRC, 'lesson-manifest.json'), JSON.stringify(out, null, 2));
const byType = lessons.reduce((a, l) => ((a[l.type] = (a[l.type] || 0) + 1), a), {});
console.log(JSON.stringify({ total: lessons.length, byType, modules: M.length }, null, 2));
