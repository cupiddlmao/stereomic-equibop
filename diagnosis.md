# Stereo diagnosis

Observed in the installed Equibop session:

- StereoMic started successfully; its WebRTC wrappers were installed.
- PipeWire reported a two-channel capture stream from `linux_mixer.microphone`.
- The active audio sender reported two channels at 48 kHz, echo cancellation off.
- Local and remote Opus descriptions included `stereo=1` and `sprop-stereo=1`.
- During the user's fully left-panned mixer test, a numeric measurement of the
  audio sender track gave left RMS 0.335 and right RMS 0. No audio was saved.

A separate local peer-to-peer test used a generated left-only tone, no Discord
server, and muted playback. Both peers connected and received packets:

| Negotiation | Received left RMS | Received right RMS |
| --- | ---: | ---: |
| Neither endpoint modified | 0.355 | 0.355 |
| Sender modified for stereo, receiver default | 0.355 | 0.355 |
| Both endpoints configured for stereo | 0.706 | 0 |

This reproduces a browser receiver downmix independently of Discord or the mixer.
The helper extension requests `stereo=1` in the receiver's local Opus SDP.
Desktop Discord clients preserved stereo from the sender alone, and the live
browser Discord test with that helper also passed on 2026-10-26 (below).

The helper uses a document-start MAIN-world content script as documented in
[Chrome's manifest reference](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts).

## 2026-10-26 live verification

A real two-account voice call was tested with left-only and right-only input.
Listeners using the official desktop Discord client reported hearing the
signal on the correct side. Discord's forwarding path therefore preserved
stereo for those clients without any receiver-side modification. The browser
listener with this repository's helper extension also reported correct left
and right separation in live browser Discord calls the same day, closing the
receiver downmix reproduced above.
