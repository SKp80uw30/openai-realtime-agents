# Liquid Glass conversation response

Liquid Glass consumes the same `OrbState` and `OrbAudioAnalysis` props as the other themes through `OrbVisualizer`. The approved glass geometry, reflections and idle blue/violet palette are preserved. Response tuning lives in `themes/liquidGlassResponse.ts`.

| State | Response |
| --- | --- |
| Idle | Slow flowing ribbons and gentle breathing |
| Ready | Slightly brighter blue, steady flow |
| Listening | Cyan highlights, attentive breathing |
| Thinking | Violet highlights, faster internal flow |
| Speaking | Audio-driven expansion, ribbon distortion and light |
| Interrupted | Brief contraction, slower flow, rose/violet accent |
| Working | Cyan/teal accents with rhythmic breathing and faster flow |

Audio uses RMS volume, waveform RMS and peaks for an amplified but bounded envelope. Bass changes expansion, mids deform/speed up the ribbons, and treble brightens highlights. Fast attack and softer release follow syllables without jitter. Silence decays back to the state's ambient animation; ambient breathing does not represent detected speech.

The shared analyser currently measures the assistant's output media stream. Listening uses the shared transcript state and its ambient cue, not a separate microphone analyser. No additional microphone permission or audio capture was introduced.

WebGL and the CSS fallback use one response driver. Context loss keeps the fallback connected to audio and state; restoration resumes the glass shader. Reduced motion disables spatial movement while retaining restrained audio light and state colour changes. Hidden tabs pause rendering.

The shared conversation-state hook now checks for user speech over an unfinished assistant response before its ordinary Listening return, allowing Interrupted to be reached.

## Verification

- Passed ESLint, TypeScript and an isolated production build of HEAD plus these changes.
- Used a temporary local integration fixture with the real `TranscriptProvider`, `useOrbConversationState`, `useOrbAudioAnalysis` and `OrbVisualizer`. No production test route was added.
- Exercised Idle → Ready → Listening → Thinking → Speaking → Interrupted → Working, tool completion and disconnect.
- Passed a generated 220 Hz media stream through the real analyser (not a direct volume prop override): quiet RMS around 0.020 produced shader energy around 0.138; loud RMS around 0.323 produced energy around 0.936; silence decayed to zero.
- Verified CSS fallback response after deliberate WebGL loss, restoration during audio, and theme switching/remounting.
- With reduced motion emulated in the fixture, time and spatial pulse remained zero while audio energy and state colours still updated.

A live authenticated Realtime conversation still needs the user's listening/visual review; the integration checks used generated audio and transcript events. No environment variables or dependencies were added.
