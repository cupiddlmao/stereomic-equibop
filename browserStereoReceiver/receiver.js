/* SPDX-License-Identifier: GPL-3.0-or-later */
(() => {
    const installed = Symbol.for("stereoMic.browserReceiver");
    const proto = globalThis.RTCPeerConnection?.prototype;
    if (!proto || proto[installed]) return;

    function stereoDescription(value) {
        if (!value?.sdp || value.type === "rollback") return value;
        const newline = value.sdp.includes("\r\n") ? "\r\n" : "\n";
        const sections = value.sdp.split(/(?=^m=)/m);
        const sdp = sections.map(section => {
            if (!section.startsWith("m=audio ")) return section;
            const lines = section.split(newline);
            for (const line of [...lines]) {
                const match = /^a=rtpmap:(\d+) opus\/48000\/2$/i.exec(line);
                if (!match) continue;
                const prefix = `a=fmtp:${match[1]} `;
                const index = lines.findIndex(item => item.startsWith(prefix));
                const existing = index < 0 ? [] : lines[index].slice(prefix.length).split(";").map(item => item.trim());
                const kept = existing.filter(item => item && !/^stereo\s*=/i.test(item));
                const fmtp = prefix + [...kept, "stereo=1"].join(";");
                if (index < 0) lines.splice(lines.indexOf(line) + 1, 0, fmtp);
                else lines[index] = fmtp;
            }
            return lines.join(newline);
        }).join("");
        return { type: value.type, sdp };
    }

    for (const key of ["createOffer", "createAnswer"]) {
        const original = proto[key];
        proto[key] = function (...args) {
            if (typeof args[0] === "function") {
                const success = args[0];
                args[0] = value => success(stereoDescription(value));
                return Reflect.apply(original, this, args);
            }
            return Reflect.apply(original, this, args).then(stereoDescription);
        };
    }
    const original = proto.setLocalDescription;
    proto.setLocalDescription = function (...args) {
        if (args[0]) args[0] = stereoDescription(args[0]);
        return Reflect.apply(original, this, args);
    };
    Object.defineProperty(proto, installed, { value: true });
    console.info("[StereoMic receiver] Stereo receive preference enabled. Rejoin voice to apply.");
})();
