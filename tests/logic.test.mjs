import assert from "node:assert/strict";
import { test } from "node:test";
import { stereoConstraints, stereoSdp } from "../stereoMic/logic.ts";

test("stereo capture keeps device and video selection and does not mutate the request", () => {
    const input = { audio: { deviceId: { exact: "virtual-stereo" }, channelCount: 1 }, video: { width: 1920 } };
    const result = stereoConstraints(input, { disableProcessing: true });
    assert.deepEqual(result.audio.deviceId, input.audio.deviceId);
    assert.deepEqual(result.video, input.video);
    assert.deepEqual(result.audio.channelCount, { ideal: 2 });
    assert.equal(result.audio.echoCancellation, false);
    assert.equal(result.audio.noiseSuppression, false);
    assert.equal(result.audio.autoGainControl, false);
    assert.equal(input.audio.channelCount, 1);
    assert.equal(stereoConstraints({ audio: false, video: true }, {}).audio, false);
    assert.equal(stereoConstraints({ audio: { echoCancellation: true } }, { disableProcessing: false }).audio.echoCancellation, true);
});

const session = ["v=0", "s=-", "t=0 0"];
const audio = ["m=audio 9 UDP/TLS/RTP/SAVPF 111 0", "a=rtpmap:111 opus/48000/2", "a=fmtp:111 minptime=10;useinbandfec=1;stereo=0;sprop-stereo=0;maxaveragebitrate=64000", "a=rtpmap:0 PCMU/8000"];
const video = ["m=video 9 UDP/TLS/RTP/SAVPF 111", "a=rtpmap:111 VP8/90000", "a=fmtp:111 max-fr=60"];

test("changes Opus only; preserves video, FEC and line endings; is idempotent", () => {
    for (const newline of ["\r\n", "\n"]) {
        const source = [...session, ...audio, ...video, ""].join(newline);
        const result = stereoSdp(source, 128000);
        assert.ok(result.includes("minptime=10;useinbandfec=1;stereo=1;sprop-stereo=1;maxaveragebitrate=128000"));
        assert.ok(result.endsWith([...video, ""].join(newline)));
        assert.equal(stereoSdp(result, 128000), result);
        assert.equal(result.split(newline).filter(l => l.startsWith("a=fmtp:111 ")).length, 2);
    }
});

test("adds missing format parameters, handles multiple audio sections, leaves non-Opus SDP alone", () => {
    const section = ["m=audio 9 UDP/TLS/RTP/SAVPF 109", "a=rtpmap:109 opus/48000/2"];
    const source = [...session, ...section, ...video, ...section, ""].join("\r\n");
    const result = stereoSdp(source, 256000);
    assert.equal(result.match(/a=fmtp:109 stereo=1;sprop-stereo=1;maxaveragebitrate=256000/g)?.length, 2);
    const noOpus = [...session, ...video, ""].join("\r\n");
    assert.equal(stereoSdp(noOpus, 128000), noOpus);
    assert.equal(stereoSdp("", 128000), "");
});
