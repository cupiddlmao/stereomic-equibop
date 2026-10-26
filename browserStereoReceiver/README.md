# Browser stereo receiver test helper

The unmodified Chromium receiver downmixed a stereo Opus stream to mono in our
local WebRTC test. Setting `stereo=1` in the receiver's local audio SDP preserved
left/right separation. This helper adds that receive preference to browser Discord.
It does not capture your microphone, read messages, or make network requests.
It affects all Opus audio connections in Discord tabs while loaded.

## Use with Brave

1. Open `brave://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this repository's `browserStereoReceiver`
   folder.
3. Reload the browser Discord tab, then join the test call with your second account.
4. Keep the browser microphone muted and playback directed to your headphones.
   Keep browser playback out of your mixer's Discord input to avoid feedback.
5. Keep your mixer's direct monitoring of the test signal off. Send a left-only
   signal from Equibop, then right-only, and listen through the browser account.

To remove it, disable/delete **Discord Stereo Receiver Test** in Brave's extensions
page, then reload Discord. Existing calls need recreation to reset negotiation.

Both receiver paths were live-verified on 2026-10-26: desktop Discord kept
stereo without this helper (its stereo negotiation alone is enough for it),
and browser Discord produced correct left/right separation with this helper,
after the receiver downmix seen in local tests. It does not change the receive
preferences of other participants.
