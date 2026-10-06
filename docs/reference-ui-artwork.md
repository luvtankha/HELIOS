# Interactive hospital consultation scene

Updated 6 October 2026. The supplied illustration guides the hospital palette, five-person cast, central speaker and speech-bubble composition. The screen is implemented directly in the project as independent vector layers. It does not swap flattened scene images.

## Source files

- `apps/web/public/images/consultation/hospital.svg`: hospital architecture, glass rooms, lighting, poster, plants and floor; no characters or application text.
- `apps/web/src/components/patient/clinician-artwork.ts`: original editable vector geometry for five distinct clinicians. Each contains named body, head, eyes, mouth, gesture-arm, tablet-arm and leg groups. The source is shared across rendering states, rather than duplicating whole scenes.
- `apps/web/src/components/patient/consultation-scene.tsx`: five persistent interactive character elements, active-speaker selection, guide tooltips and accessible names.
- `apps/web/src/components/patient/live-consultation.module.css`: positioning, depth, transitions, gesture animation, responsive framing and reduced-motion support.
- `apps/web/src/components/patient/live-doctor-consultation.tsx`: existing consent, Hindi captions, microphone recovery, completion and live voice integration.

## Interaction and state

The backend's `doctorAvatarId` selects the foreground guide. A handoff changes the positions and scale of the existing characters; it does not replace their DOM nodes. All five supported IDs have their own artwork: `lead-general`, `clinician-female`, `clinician-general`, `clinician-surgical`, and `clinician-senior`. Unknown IDs fall back to the lead guide.

During model audio playback the active guide gestures and animates its mouth. Listening uses an attentive pose and halo. Supporting characters remain present with subtle idle motion. Tapping or keyboard-focusing a character reveals its Hindi name and AI-guide role, without choosing a medical specialty or changing the conversation. The characters are animated UI guides, not real doctors or independent medical agents.

Motion follows the existing voice playback state. The mouth animation is a speaking indicator, not phoneme-accurate lip synchronization. Browser reduced-motion preferences disable scene animations and transitions while preserving state and interactivity.

## Design and performance

The environment is cached as one SVG resource. Character vectors are generated once at module initialization, with unique gradient IDs. Handoffs use CSS transforms; movement does not require loading new poses, videos, animation libraries or image atlases. Speech text remains live HTML, separate from artwork.

The previous four WebP scene assets are obsolete and moved into the sibling `items to be deleted` folder. Figma work was stopped at the user's request; the implemented artwork and animation live in these project files.

## Verification

`tests/e2e/live-consultation.spec.ts` exercises consent, native-audio captions, listening, reconnection, all four specialist handoffs, stable character identity, actual position/scale changes, keyboard interaction, reduced motion, completion and accessibility. It uses synthetic local API/audio events and does not claim a new live-provider conversation test.
