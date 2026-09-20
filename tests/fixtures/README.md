# Speech regression fixture

`speech-en.wav` is synthesized test audio, not a patient recording. Its text is: “I have had a fever and a headache for three days.” It was generated locally with Windows System.Speech. Chromium's fake audio device feeds it into the real MediaRecorder, multipart upload, local model and patient confirmation path in `full-browser-journey.spec.ts`. The test checks that the recognized result contains fever and headache rather than the old mock provider's stomach-pain sentence.

The input device is simulated; transcription and clinical API/database requests are real. An edit request is deliberately failed once to verify that the transcript remains editable and retry succeeds. Normal interactive sessions use the actual microphone; the fake-device arguments appear only in the Playwright test configuration.
