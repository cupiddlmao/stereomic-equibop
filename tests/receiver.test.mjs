import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";

const code = readFileSync(new URL("../browserStereoReceiver/receiver.js", import.meta.url), "utf8");
const sample = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10;stereo=0;useinbandfec=1\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=rtpmap:96 VP8/90000\r\na=fmtp:96 max-fr=60\r\n";

function setup() {
    class Peer {
        createOffer(callback) {
            const description = { type: "offer", sdp: sample };
            return callback ? callback(description) : Promise.resolve(description);
        }
        createAnswer() { return Promise.resolve({ type: "answer", sdp: sample }); }
        setLocalDescription(...args) { this.args = args; return Promise.resolve(); }
        setRemoteDescription() {}
    }
    const context = vm.createContext({ RTCPeerConnection: Peer, console: { info() {} } });
    vm.runInContext(code, context);
    return { Peer, context };
}

test("receiver requests stereo while preserving other codecs and parameters", async () => {
    const { Peer } = setup();
    const peer = new Peer();
    const result = await peer.createOffer();
    assert.ok(result.sdp.includes("minptime=10;useinbandfec=1;stereo=1"));
    assert.ok(result.sdp.endsWith("m=video 9 UDP/TLS/RTP/SAVPF 96\r\na=rtpmap:96 VP8/90000\r\na=fmtp:96 max-fr=60\r\n"));
    assert.equal(result.type, "offer");
    await peer.setLocalDescription(result);
    assert.equal(peer.args[0].sdp, result.sdp);
    assert.equal(peer.args[0].sdp.match(/stereo=1/g).length, 1);
});

test("receiver handles inherited description fields, callbacks and omitted arguments", async () => {
    const { Peer, context } = setup();
    const peer = new Peer();
    let callback;
    peer.createOffer(result => { callback = result; });
    assert.ok(callback.sdp.includes("stereo=1"));
    const inherited = Object.create({ type: "answer", sdp: sample });
    await peer.setLocalDescription(inherited);
    assert.equal(peer.args[0].type, "answer");
    assert.ok(peer.args[0].sdp.includes("stereo=1"));
    await peer.setLocalDescription();
    assert.equal(peer.args.length, 0);
    const original = Peer.prototype.createOffer;
    vm.runInContext(code, context);
    assert.equal(Peer.prototype.createOffer, original);
});
