# Day 3 PRD — VoicePay Frontend Personalization for Banking

**Challenge:** #VoiceForBharat — 10 Days of Voice Agents by Murf AI
**Track:** Financial Services (Banking Assistant for Bharat)
**Product:** VoicePay — India's first truly Indian voice banking assistant
**Date:** Day 3 of 10

---

## 1. Decision: Replace or Enhance?

### The Question
Should we throw away our existing frontend and adopt the [LiveKit agent-starter-react](https://github.com/livekit-examples/agent-starter-react) template, or evolve what we already have?

### Analysis Matrix

| Dimension | Our Current Frontend | LiveKit Starter Template | Winner |
|---|---|---|---|
| **Track fit (banking)** | ✅ Persona picker (Anisha/Samar/Pooja), Bharat-focused welcome, transaction canvas | ❌ Generic developer-tool aesthetic, no banking context | **Ours** |
| **Voice persona choice** | ✅ Custom TokenSource passes voice selection via room metadata | ❌ Voice hardcoded in backend, no runtime switching | **Ours** |
| **Mid-call voice switch** | ✅ Floating VoiceSwitcher component + data channel hot-swap | ❌ Not supported | **Ours** |
| **Visual canvas (data cards)** | ✅ 6 card renderers, spring-animated slide-up panel | ❌ Just text transcript | **Ours** |
| **Audio visualizers** | ✅ 5 styles (aura/bar/grid/radial/wave) inherited from starter | ✅ Same 5 styles | **Tie** |
| **Theme system** | ✅ Light/dark + system preference | ✅ Same | **Tie** |
| **Guardrail UI** | ✅ Session stats displayed, escalation card renders on red flags | ❌ Not present | **Ours** |
| **Bharat-first UX** | ✅ Hindi/English mix in welcome copy, INR formatting, TRAI-DND aware | ❌ English-only, US-defaults | **Ours** |
| **Agent state visibility** | ⚠️ Has "listening/speaking/thinking" pill but small, not a hero | ✅ Visualizer is centerpiece | **Starter wins** |
| **Mic permission errors** | ❌ Not handled explicitly | ⚠️ Basic browser default | **Neither — both need work** |
| **Live transcript styling** | ⚠️ Functional but plain | ✅ Prettier | **Starter wins** |
| **Ready → Connecting → Call Ended states** | ⚠️ Partial (Ready + Connecting exist, no explicit end-screen) | ⚠️ Also partial | **Neither — both need work** |
| **Mobile responsive** | ⚠️ Untested at true phone widths | ⚠️ Same | **Neither — both need work** |

### Verdict: **ENHANCE, don't replace.**

Our frontend already has:
- Every banking-specific advantage (persona, canvas, guardrails, Bharat copy)
- The exact same underlying LiveKit primitives, visualizers, and theming
- Working custom TokenSource for voice persona
- Working data channel for mid-call switching

The starter has zero features we lack. Its only advantage is a marginally cleaner default aesthetic — which we can match with targeted UI upgrades.

**Throwing it away would delete 3 days of custom work for zero net gain.** Instead, Day 3 upgrades our existing frontend to nail every Day 3 requirement AND every optional bonus, plus 8 advanced banking-specific features the starter doesn't have.

---

## 2. Day 3 Requirements — Coverage Plan

### Step 1: Personalized frontend for the track
**Current state:** Bharat welcome copy, persona picker, INR formatting.
**Day 3 upgrade:**
- New brand identity: "VoicePay — Aapka Voice Banking Saathi"
- Color system: Indian tricolor accent (saffron highlight, deep-navy trust, off-white bg) — banking = trust + confidence
- Icon system: rupee glyphs, bank/lock icons, Bharat map watermark
- Typography: pair a warm humanist font (Manrope) for body with a more formal display (Fraunces) for the balance amounts

### Step 2: Five agent states clearly shown
| State | Current | Day 3 Target |
|---|---|---|
| **Ready** | Welcome view + start button | ✅ Keep, plus prominent hero "Start Talking to Anisha" button, mic-check pulse |
| **Connecting** | No dedicated screen | ✅ NEW: Full-screen "Connecting to your bank…" with animated dots, cancels on failure |
| **Listening** | Small pill | ✅ NEW: Center visualizer glows blue with "Listening… bolo aap" caption |
| **Speaking** | Small pill | ✅ NEW: Center visualizer glows warm with agent name + waveform of TTS output |
| **Call ended** | Just disconnects | ✅ NEW: End-screen with call summary (duration, topics discussed, "Start again" CTA + "Rate this call") |

### Step 3: Clear "who is speaking" indication
**Current:** small pill.
**Day 3 upgrade:**
- Center-stage audio visualizer that changes both color AND label
- User speaking → cyan visualizer + "You" label + input volume bar
- Agent speaking → saffron visualizer + agent name + persona avatar chip
- Both idle → soft neutral glow + "Silent"
- Add a top status strip: `● Anisha • Speaking` or `● You • Listening`

### Step 4: Microphone permission error handling
**Current:** none.
**Day 3 upgrade:**
- Pre-connect mic check on welcome screen (green tick if allowed, request prompt if not)
- If denied: full-screen modal with:
  - Clear message in Hindi + English: "Mic access chahiye. Bina mic ke hum baat nahi kar sakte."
  - Browser-specific instructions (Chrome/Safari/Firefox screenshots) for re-enabling
  - "Try again" button that re-requests permission
  - Fallback: "Text mode chalu karo" that switches to typed input (uses existing chat transcript)
- Handle other errors: no mic device, mic in use by another app, network fail

### Step 5: End-to-end flow test
Manual QA checklist added to `Day3-QA-CHECKLIST.md`.

### Step 6: Mobile responsive
**Target breakpoints:** 375px (iPhone SE), 390px (iPhone 14), 414px (Plus models).
**Fixes:**
- Persona pills stack vertically below 480px
- Canvas panel becomes bottom-sheet (75vh) on mobile
- Control bar sticks to bottom with safe-area-inset padding for iPhone notch
- Touch targets ≥44×44px (Apple HIG minimum)

### Step 7: Demo video script prepared → `Day3-DEMO-SCRIPT.md`

### Step 8: LinkedIn post draft → `Day3-LINKEDIN.md`

---

## 3. Advanced (Optional) Requirements — ALL to be done

| Advanced feature | Plan |
|---|---|
| **Live transcript** | Already have it. Upgrade: user bubbles right (blue), agent bubbles left (saffron), auto-scroll, timestamp on hover, "Download transcript" button |
| **User's language** | Detect from persona pick + first utterance. If Hindi persona chosen → welcome copy + button labels flip to Devanagari |
| **Low-bandwidth support** | Detect via `navigator.connection.effectiveType`. On 2G/3G: reduce visualizer FPS, disable canvas animations, show "Slow network — audio only" banner |

---

## 4. Extra Banking-Grade Features (Beyond Requirements)

These are what will make VoicePay stand out from every other submission:

### 4.1 Trust Bar (top of screen, always visible)
```
🔒 End-to-end encrypted • RBI-compliant • Aapka data safe hai
```
Banking = trust. Show it always.

### 4.2 Session Timer + Auto-Timeout
- Visible timer: "01:23"
- After 2 min silence → soft warning: "Kuch aur puchhna hai?"
- After 3 min silence → auto-disconnect with reason shown

### 4.3 Persona Card in Session
Replace generic avatar with a rich persona card in the corner:
```
┌─────────────────────┐
│ 👩 Anisha           │
│ Bilingual • Warm    │
│ ● Speaking          │
│ [Switch Voice ▾]    │
└─────────────────────┘
```

### 4.4 Quick-Action Chips (below input)
Instead of blank staring, show 4 tappable prompts:
- "Mera balance batao"
- "Last transactions"
- "EMI calculate karo"
- "UPI kaise bhejta hai"

Tap → sends as voice command to agent. Solves cold-start UX.

### 4.5 Waveform for Both Sides
- User's mic → real-time input waveform (Web Audio API `AnalyserNode`)
- Agent's TTS → output waveform (LiveKit track analysis)
- Both visible simultaneously so user sees who has the "conch"

### 4.6 Call Recording Consent (RBI compliance vibe)
On start: modal "Yeh conversation quality ke liye record ho sakti hai. Agree?" [Agree] [Text mode]

### 4.7 Emergency Escalation Button
Floating red button always visible: "🚨 Talk to Human"
Tap → immediate handoff card with support numbers. This is a real banking need.

### 4.8 Post-Call Insights
After disconnect:
```
Call Summary
──────────────
Duration: 2m 34s
Topics: Balance, EMI calc
Actions taken: 3
Escalations: 0
Language: Hinglish

[Save transcript] [Rate call] [Start new call]
```

---

## 5. Component-Level Plan

### New components to build
| File | Purpose |
|---|---|
| `components/app/connecting-view.tsx` | Full-screen connecting state with cancel |
| `components/app/call-ended-view.tsx` | Post-call summary + restart CTA |
| `components/app/mic-permission-gate.tsx` | Handles all mic error states |
| `components/app/agent-state-hero.tsx` | Center-stage state visualizer + label |
| `components/app/trust-bar.tsx` | Persistent security/compliance strip |
| `components/app/persona-card.tsx` | Rich agent identity card |
| `components/app/quick-actions.tsx` | Suggested prompt chips |
| `components/app/session-timer.tsx` | Elapsed time + inactivity handling |
| `components/app/emergency-button.tsx` | Human-handoff CTA |
| `hooks/useMicPermission.ts` | Wraps `navigator.permissions.query({ name: 'microphone' })` |
| `hooks/useNetworkQuality.ts` | Wraps `navigator.connection` for adaptive UI |
| `hooks/useInactivityTimeout.ts` | 2-min soft, 3-min hard timeout |
| `hooks/useUserAudioLevel.ts` | Web Audio API analyzer for user waveform |
| `lib/i18n.ts` | Hindi/English string tables |

### Existing components to upgrade
| File | Change |
|---|---|
| `components/app/welcome-view.tsx` | New hero copy, mic check, quick-action preview, trust bar |
| `components/app/view-controller.tsx` | Add Connecting + Ended states to state machine |
| `components/agents-ui/blocks/agent-session-view-01/components/agent-session-block.tsx` | Wire in hero visualizer, persona card, timer, quick actions, emergency button |
| `components/app/canvas-panel.tsx` | Mobile-responsive bottom-sheet mode |
| `app/page.tsx` | Add mic-permission-gate wrapper |
| `styles/globals.css` | New color tokens for banking theme |

---

## 6. Visual Design Direction

### Color System
```css
--brand-primary: #FF6B35;     /* Saffron — action buttons */
--brand-secondary: #002B5C;    /* Deep navy — trust */
--brand-accent: #00A86B;       /* Growth green — success states */
--brand-danger: #E63946;       /* Alert red — escalations */
--brand-bg-light: #FFFAF3;     /* Warm off-white */
--brand-bg-dark: #0A0E1A;      /* Deep space navy */
--brand-glass: rgba(255,250,243,0.08);  /* Glass panels */
```

### Typography
- **Display (numbers, headings):** Fraunces — banking gravitas
- **Body (dialog, labels):** Manrope — friendly + legible
- **Mono (transactions, ref IDs):** CommitMono (already in project)

### Motion
- Spring physics for panels (stiffness 260, damping 20)
- 200ms crossfades between states
- Reduce-motion honored via `prefers-reduced-motion`

---

## 7. Non-Functional Requirements

| Category | Target |
|---|---|
| Lighthouse Performance | ≥ 90 mobile |
| Lighthouse Accessibility | ≥ 95 |
| First Contentful Paint | < 1.5s on 3G |
| Cumulative Layout Shift | < 0.1 |
| WCAG level | AA (color contrast ≥ 4.5:1) |
| Touch target size | ≥ 44×44px |
| Works offline (welcome) | Basic PWA cache |

---

## 8. Success Criteria (Day 3 Definition of Done)

- [ ] Frontend visually matches banking track (colors, copy, iconography)
- [ ] All 5 agent states (Ready/Connecting/Listening/Speaking/Ended) are visually distinct and unmissable
- [ ] "Who is speaking" is obvious without reading text — visualizer color + label
- [ ] Mic-denied user sees a helpful modal with re-enable instructions AND a text-mode fallback
- [ ] Full flow works: land → connect → talk → disconnect → restart, on desktop AND on iPhone 14 Safari
- [ ] Live transcript polished and downloadable
- [ ] Hindi/English UI toggle works with the persona picker
- [ ] Slow-network mode kicks in on 3G and shows a banner
- [ ] All 8 banking-grade extras shipped
- [ ] Demo video recorded showing every flow
- [ ] LinkedIn post drafted with Murf AI tag + #VoiceForBharat + #10DaysOfVoiceAgents hashtags

---

## 9. Execution Order (recommended sequencing)

**Wave 1 — Core states (2 hrs)**
1. `mic-permission-gate.tsx` + `useMicPermission.ts`
2. `connecting-view.tsx`
3. `call-ended-view.tsx`
4. Update `view-controller.tsx` state machine

**Wave 2 — Hero state visualizer (1.5 hrs)**
5. `agent-state-hero.tsx` (color-changing centerpiece)
6. `useUserAudioLevel.ts` for user waveform
7. Wire into `agent-session-block.tsx`

**Wave 3 — Banking polish (1.5 hrs)**
8. `trust-bar.tsx`
9. `persona-card.tsx`
10. `quick-actions.tsx`
11. `session-timer.tsx` + `useInactivityTimeout.ts`
12. `emergency-button.tsx`

**Wave 4 — i18n + adaptive (1 hr)**
13. `lib/i18n.ts` + Hindi copy tables
14. `useNetworkQuality.ts` for slow-net banner
15. Mobile breakpoints across all components

**Wave 5 — Polish + QA (1 hr)**
16. New color tokens in `globals.css`
17. Font swap (Fraunces + Manrope via `next/font`)
18. Full E2E test on Chrome, Safari, iPhone Safari
19. Lighthouse audit — fix anything below target

**Wave 6 — Ship (30 min)**
20. Copy Day2 → Day3 folder
21. Commit + push
22. Record demo video
23. Draft LinkedIn post

**Total:** ~7.5 hours of focused work.

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Font loading blocks FCP | Use `next/font` with `display: 'swap'` |
| Mic permission API not consistent across browsers | Fallback to feature-detect + try/catch on `getUserMedia` |
| iOS Safari doesn't fire `permissions.query` reliably | Direct `getUserMedia` probe on button press |
| Adding too many features breaks the existing flow | Feature-flag each new component behind a boolean until QA passes |
| Canvas bottom-sheet on mobile conflicts with iOS home-indicator | `env(safe-area-inset-bottom)` padding |
| Slow-network detection unreliable | Combine `navigator.connection` with observed round-trip time |
| Hindi text rendering issues | Test Devanagari with system fonts before pulling in Google Noto |

---

## 11. What Makes This Submission Win

Every other participant will use the LiveKit starter as-is with minor recoloring. VoicePay's Day 3 submission stands out because:

1. **True Bharat feel** — Hindi copy, persona choice, INR formatting, Trust bar, TRAI-DND awareness — not a US template with saffron paint
2. **Real banking UX patterns** — Trust bar, emergency escalation, call summary, quick actions — things a real bank would ship
3. **Every optional advanced feature done** — live transcript, i18n, low-bandwidth mode
4. **Beyond the brief** — 8 extras that no rubric item asked for but every user will notice
5. **Mobile-first** — most Bharat users are on phones; every other demo will be desktop-only
6. **Accessibility** — WCAG AA, reduce-motion, touch targets — production-grade
7. **Complete state machine** — 5 states as REQUIRED, but each one polished, not just present

The judges will remember VoicePay because it feels like a real product, not a hackathon demo.
