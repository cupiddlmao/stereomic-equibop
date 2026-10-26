# StereoMic for Equibop

Experimental Equicord userplugin for **Equibop on Linux**, including CachyOS.
It requests two-channel microphone capture, requests Opus stereo in local and
remote audio SDP, and lets you choose a requested bitrate (128 kbps by default).
It can request capture without echo cancellation, noise suppression, and automatic
gain control. It does not patch or replace `discord_voice.node`.

A live two-account Discord call on 2026-10-26 confirmed that listeners on the
official desktop Discord client receive separate left and right channels.
Capture settings and SDP alone still do not prove stereo everywhere: browser
Discord needed the included receiver helper in local tests, and Discord's
audio graph, input hardware, or PipeWire routing may still downmix or limit
bitrate. A mono microphone cannot supply distinct left and right channels. All WebRTC Opus audio sessions in Equibop, including screen-share
audio, are affected while the plugin is enabled; video SDP is left alone.

## Install

Userplugins require a source build of Equicord. Equibop itself can stay installed
as it is. If you already have an Equicord checkout, use that checkout and preserve
any other userplugins you have there.

For a new checkout, with Git, Node.js 22+ and pnpm installed:

```bash
git clone https://github.com/Equicord/Equicord.git
cd Equicord
pnpm install --frozen-lockfile
mkdir -p src/userplugins
cp -r /path/to/stereomic-equibop/stereoMic src/userplugins/
pnpm build --dev
```

In **Equibop Settings → Developer Settings → Equicord Location → Change**, select
the checkout's **dist** folder. Fully restart Equibop, then open Equicord's Plugins
settings and enable **StereoMic**. Set its bitrate/processing preferences and leave
and rejoin voice. Repeat the build and restart after changing plugin files.

Do not use the official Discord client's injection command (`pnpm inject`) for
Equibop. This plugin intentionally declines to start outside Equibop.

## Verify stereo

**If the listener is browser Discord, install the included
[browser receiver helper](browserStereoReceiver/README.md), reload that Discord
tab, and rejoin voice first.** In a local Chromium WebRTC test, sender-only stereo
negotiation still produced mono playback on an unmodified receiver. Requesting
stereo on the receiver too preserved left/right separation. That test does not
by itself establish what Discord forwards to other clients. In the live call,
desktop Discord listeners heard stereo from the sender alone; the helper is for
browser receivers, which are the ones that downmixed locally.

1. Select a genuine stereo input or a stereo virtual source in Discord. On CachyOS,
   use your PipeWire routing tool (such as an already-installed qpwgraph or Helvum)
   to feed distinct left and right signals into that source.
2. Disable Krisp, noise suppression, echo cancellation, and automatic gain in
   Discord's Voice & Video settings for the test. The plugin's capture constraints
   cannot guarantee that later Discord processing is bypassed. Use headphones
   when disabling echo cancellation.
3. Leave and rejoin voice after enabling the plugin or changing its settings.
4. Send a left-only signal, then a right-only signal. Have a second participant
   listen with headphones and confirm that each plays on the corresponding side.
   Discord's microphone test alone is not sufficient evidence.
5. The developer console logs **StereoMic → Captured input** with the channel count
   reported by the browser. If it is 1 or unknown, investigate the selected input.
   A reported count of 2 still needs the listening test above.

If a call fails or the sound is wrong, disable StereoMic and leave/rejoin voice.
Restart Equibop if necessary. Disabling restores hooks where possible, but existing
tracks and negotiated calls retain their settings until recreated. To return to
your previous Equicord build, restore its location in Equibop Developer Settings.

## Checks

Run `npm test` from this folder with Node.js 22.18+ (native TypeScript stripping).
The tests cover constraints and SDP handling: device selection, unchanged video,
non-Opus codecs, existing parameters, missing fmtp, multiple audio sections,
line endings, and repeated transformations.

The plugin is also intended to be checked with `pnpm exec tsc --noEmit` and
`pnpm build --dev` from an Equicord checkout containing it. A successful build is
not a live audio compatibility test.

## References

- [Equicord userplugin setup](https://docs.equicord.org/plugins/)
- [Equibop local development builds](https://equibop.org/wiki/linux/dev-build/)
- [Opus SDP and stereo parameters (RFC 7587)](https://www.rfc-editor.org/rfc/rfc7587)
- [Original reference project](https://github.com/ProdHallow/Discord-Stereo-Windows-MacOS-Linux)

The reference project uses native voice-module tooling and marks itself discontinued.
This plugin is independently implemented for Equibop's WebRTC path; it is not a
port of that binary patcher.
