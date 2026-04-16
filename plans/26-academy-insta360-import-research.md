# Plan 26 — External Research Brief (Insta360 Direct Import)

> **Purpose:** answer the four open questions in [plan 26 §3](26-academy-insta360-import.md) so the plan can either unblock, cancel, or fall back to the §4 smaller v1.
> **Status:** research complete on 3 of 4 public items; survey + devrel email drafted; **awaiting teacher-camera survey results** before final decision.
> **Date:** 2026-04-16
> **Researcher:** Claude (web research + public docs)

---

## TL;DR

| §3 question | Answer | Confidence |
|---|---|---|
| 1. Public SDK / documented file format? | **Yes.** Open SDK application, ~3 business days approval. | High |
| 2. Mobile app third-party share sheet / URL scheme? | **No.** Hardcoded YouTube/Facebook/Street View only. | High |
| 3. NDA or commercial licensing? | **No public evidence of an NDA or fee** for the base SDK. Need direct confirmation for commercial SaaS redistribution. | Medium |
| 4. Insta360 actually dominant among our teachers? | **Unknown — needs survey.** Draft survey in §5 below. | — |

**Recommended path:** ship the §4 smaller v1 (aspect-ratio warn + filename-based title suggestion) immediately — it's valuable regardless of §3 outcomes. Run the teacher survey in parallel; keep the full plan 26 on ice until the survey comes back.

**If the survey says >60% of teachers use Insta360**, re-evaluate the full plan with updated scope (desktop-only — mobile is dead per §2 below). **If <40%**, cancel plan 26 proper; the smaller v1 is the ceiling.

---

## 1. SDK availability (§3.1)

**Finding:** Public and accessible.

- Developer home: <https://www.insta360.com/developer/home>
- SDK application: <https://www.insta360.com/sdk/apply> — self-service form, approval emailed within 3 business days
- GitHub org: <https://github.com/Insta360Develop> — iOS-SDK, Android-SDK, Desktop-CameraSDK-Cpp, etc.
- Online manual: <https://onlinemanual.insta360.com/developer/en-us/resource/sdk>

**Current versions (April 2026):**
- Android SDK V1.10.1 (Mar 31, 2026)
- Windows SDK Camera V2.1.1 / Media V3.1.3 (Jan 29, 2026)
- iOS SDK V1.9.2

**Capabilities split across two SDKs:**
- **Camera SDK** — connect, preview stream, parameter config, shutter control, file list/delete/transfer, panoramic live streaming.
- **Media SDK** — stitching, image/video export, preview/display.

**Supported cameras:** X5, X4Air, X4, X3, ONE RS 1-Inch, ONE RS, ONE X2, ONE R, ONE X.

**Platform minimums:** Windows 7, Ubuntu 22.04, Android 10, iOS 13. No emulator support. Desktop apps require admin privileges.

**Implication for plan 26:** The file-transfer and stitching-export capabilities we'd need for direct camera-to-Cloudinary import are explicitly supported. A native companion app is feasible. **But — CentenarianOS is a web app**, and the SDK does not appear to expose a web/browser runtime. Any integration would require shipping a native companion (mobile app or desktop helper), which is a ~quarter-plus of work we haven't scoped.

---

## 2. Mobile share path (§3.2)

**Finding:** Dead for web apps. Hardcoded list of share destinations; no OS share sheet, no custom URL scheme support documented.

Per the Insta360 app sharing docs (<https://onlinemanual.insta360.com/app/en-us/operation-tutorial/file-sharing/social-media-platforms>): after export, the only direct share targets are YouTube, Facebook, and Google Street View. For everything else, users fall back to copying a shareable link.

**PWA Web Share Target API** is a theoretical alternative (any PWA can register as a target), but it only works if the originating app invokes the OS share sheet. Insta360 doesn't.

**Implication:** the "Continue in CentenarianOS" deep-link concept from plan 26 §2 is **not achievable** as designed. Any mobile path would require users to first export the video to Photos/Files and then upload from our web form — which is **the flow they already have**. No improvement possible without Insta360 changing their app.

---

## 3. Licensing and commercial terms (§3.3)

**Finding:** No public evidence of NDA, license fee, or commercial restriction on the base SDK. **But** the public docs are silent on commercial redistribution terms — we cannot assume a permissive license without confirmation.

- SDK application form is self-service and does not mention commercial tiers
- GitHub repos are public (no gated access to README/docs)
- Published blog: <https://www.insta360.com/blog/enterprise/insta360-sdk-online-application.html> — confirms "online application" model, no fee mentioned

**Open questions** (see §4 draft email):
- Is there a commercial-use carve-out vs. hobbyist use?
- Do integrations need to credit Insta360 (attribution, logo placement)?
- Is there a review/approval stage before we ship integrations to production?

**Implication:** likely safe to apply and start prototyping, but we should get these in writing before shipping a production integration.

---

## 4. Devrel email — draft

Send from a CentenarianOS-branded address. Keep it short; they receive volume.

> **Subject:** SDK licensing questions — CentenarianOS (education / LMS integration)
>
> Hi Insta360 Developer Team,
>
> We're building CentenarianOS, a learning-platform SaaS (<https://centenarianos.com>) where educators publish 360° video courses. Several of our teachers use Insta360 cameras and we're evaluating building a direct import path from Insta360 Studio exports into our lesson editor.
>
> Before I apply for SDK access, I'd like to confirm three things that aren't covered in the public docs (<https://onlinemanual.insta360.com/developer/en-us/resource/sdk>):
>
> 1. **Commercial redistribution:** is there a separate license or fee for commercial/SaaS products that ship an integration built on the SDK, or is the standard application sufficient?
> 2. **Attribution requirements:** does a shipped integration need to display Insta360 branding, logo, or an attribution string in-app?
> 3. **Review stage:** is there an approval/review step between "SDK access granted" and "shipping to production," or can we ship as soon as we're comfortable with our integration?
>
> Our specific use case is **desktop-only** — we'd read an equirectangular MP4 exported from Insta360 Studio and pipe it through our existing Cloudinary upload path. No camera control, no live streaming.
>
> Happy to share more detail if useful. Thanks for your time.
>
> — {Name}
> {Title}, CentenarianOS

---

## 5. Teacher-camera survey — draft

**Purpose:** validate or falsify plan 26 §3.4 — the assumption that Insta360 is the dominant camera among CentenarianOS teachers.

**Distribution:** in-product banner to users with `role IN ('teacher', 'admin')` that opens a 5-question Typeform (or the in-app feedback modal). Also DM to the top ~20 active teachers directly.

**Incentive:** free month of the teacher plan (no new Stripe flow — comp via admin override).

**Target N:** 30+ responses. Decision thresholds: if Insta360 >60%, pursue full plan 26 desktop-only. If 40–60%, ship smaller v1 only. If <40%, cancel plan 26 proper.

**Survey questions** (keep to 5; teachers won't finish 10):

1. Do you currently shoot 360° video for your courses, or are you planning to in the next 6 months?
   - [ ] Yes, shooting now
   - [ ] Planning to, within 6 months
   - [ ] No, and no plans
   *(If "No" → skip to Q5)*

2. Which 360° camera(s) do you use or plan to use? (multi-select)
   - [ ] Insta360 (any model)
   - [ ] GoPro Max
   - [ ] Ricoh Theta
   - [ ] Insta360 Pro / Pro 2 (pro tier)
   - [ ] Qoocam
   - [ ] Other (specify)
   - [ ] Haven't decided

3. How do you currently get a 360° video into CentenarianOS? (single-select)
   - [ ] Export from camera app, upload via our Cloudinary widget
   - [ ] Host on YouTube/Vimeo, paste URL
   - [ ] Host on my own server, paste URL
   - [ ] I've been blocked by the upload process
   - [ ] Haven't published a 360° lesson yet

4. Which of these would most reduce the friction in your 360° publishing workflow? (rank top 3)
   - Direct "Send to CentenarianOS" button in the Insta360 / GoPro app
   - Drag-and-drop from Insta360 Studio's export folder
   - Automatic stitching (we stitch the dual-fisheye file for you)
   - Auto-generated poster thumbnail from frame 0
   - Auto-filled lesson title from the filename
   - Larger upload size limits
   - Other (specify)

5. Would you be willing to do a 15-minute screenshare with us showing your current 360° publishing workflow? (yes/no + email)

**Exit note:** thanks, no answer is required, we won't contact you unless you checked Q5.

---

## 6. What about the §4 smaller v1?

Plan 26 §4 already describes a fallback that doesn't depend on any of the above research: **aspect-ratio check + filename-pattern title suggestion + drag-and-drop**. Our existing `Cloudinary360Uploader` already supports drag-and-drop (the Cloudinary widget does this natively), so the remaining work is:

1. **Aspect-ratio warn:** after successful upload, if `width / height` is not in `[1.95, 2.05]`, show a non-blocking warning "This file may not be equirectangular — it should have a 2:1 width-to-height ratio. If your footage looks stretched or frozen, export the stitched version from Insta360 Studio and try again."
2. **Filename → title:** detect common prefixes and suggest a lesson title:
   - `VID_YYYYMMDD_HHMMSS_XX_XXX.insv` → "Insta360 recording, {date} {time}" (Insta360 X series)
   - `IMG_YYYYMMDD_HHMMSS_XX.insp` → "Insta360 photo, {date} {time}"
   - `GS0{6 digits}.360` → "GoPro Max recording {date}"
   - `R00{5 digits}.mp4` → "Ricoh Theta recording {date}"
3. **Gotcha to flag:** our current `clientAllowedFormats` includes `insv`, which can be either raw dual-fisheye OR stitched equirectangular. Consumer cameras output raw fisheye by default — if a teacher uploads a raw `.insv` without stitching it first, PSV will render a stretched blob. The existing helper text mentions "export the stitched equirectangular file from Insta360 Studio first," but we could add a server-side guard or just drop `insv` from the whitelist and require MP4/MOV (post-export formats).

**Effort:** ~1 hour for all three. Zero external dependencies. Valuable whether plan 26 proper ships or not.

---

## 7. Recommended decision tree

```
[Teacher survey runs]
    ├─ Insta360 >60%: pursue plan 26 desktop-only
    │      └─ send devrel email, confirm commercial terms
    │             └─ scope a native desktop companion (Electron? Tauri?)
    │             └─ ~quarter of work — revisit prioritization
    │
    ├─ Insta360 40–60%: skip plan 26 proper, ship §4 smaller v1 only
    │
    └─ Insta360 <40%: cancel plan 26, ship §4 smaller v1 only, close the plan doc with a "cancelled after research" note
```

**Independently and immediately:** ship the §4 smaller v1. It helps every teacher regardless of camera brand.

---

## 8. Sources

- [Insta360 Enterprise Developer Home](https://www.insta360.com/developer/home)
- [Insta360 SDK Guide](https://onlinemanual.insta360.com/developer/en-us/resource/sdk)
- [Insta360 GitHub org](https://github.com/Insta360Develop)
- [iOS SDK repo](https://github.com/Insta360Develop/iOS-SDK)
- [Android SDK repo](https://github.com/Insta360Develop/Android-SDK)
- [Desktop CameraSDK-Cpp](https://github.com/Insta360Develop/Desktop-CameraSDK-Cpp)
- [Insta360 app sharing tutorial](https://onlinemanual.insta360.com/app/en-us/operation-tutorial/file-sharing/social-media-platforms)
- [Google Spherical Video V2 RFC](https://github.com/google/spatial-media/blob/master/docs/spherical-video-v2-rfc.md)
- [Insta360 SDK Online Application announcement](https://www.insta360.com/blog/enterprise/insta360-sdk-online-application.html)
- [INSV format notes — peterbraden](https://peterbraden.co.uk/article/360-video-insv/)

---

## 9. Next actions for the human

1. **Owner decision:** send the devrel email in §4 (paste into your mail client, fill {Name}/{Title}). Expected response: 3–7 business days.
2. **Run the survey in §5:** copy questions into Typeform or your survey tool of choice. Launch in-app banner + DM top 20 teachers. Close survey after 14 days.
3. **Greenlight smaller v1:** authorize me to start on the §4 smaller v1 (~1 hour of work) on a new branch — it's independent of the research outcomes.

Once you've sent the email and launched the survey, this research phase is done. Report back with the responses and we'll either unblock or cancel plan 26 accordingly.
