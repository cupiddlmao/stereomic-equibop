/*
 * Equicord userplugin for Equibop
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";

import { stereoConstraints, stereoSdp } from "./logic";

const logger = new Logger("StereoMic");
const settings = definePluginSettings({
    bitrate: {
        type: OptionType.SELECT,
        description: "Requested Opus bitrate. Rejoin the call after changing; Discord may impose a lower limit.",
        options: [
            { label: "64 kbps", value: 64000 },
            { label: "128 kbps", value: 128000, default: true },
            { label: "192 kbps", value: 192000 },
            { label: "256 kbps", value: 256000 },
            { label: "384 kbps", value: 384000 },
            { label: "510 kbps", value: 510000 }
        ]
    },
    disableProcessing: {
        type: OptionType.BOOLEAN,
        description: "Request capture without echo cancellation, noise suppression, or automatic gain. Use headphones. Rejoin after changing.",
        default: true
    }
});

let enabled = false;
let cleanups: Array<() => void> = [];

// Restore only our own wrapper, so disabling cannot remove another plugin's hook.
function wrap<T extends object, K extends keyof T>(object: T, key: K, make: (original: T[K]) => T[K]) {
    const original = object[key];
    const wrapped = make(original);
    object[key] = wrapped;
    cleanups.push(() => {
        if (object[key] === wrapped) object[key] = original;
    });
}

function description(value: RTCSessionDescriptionInit): RTCSessionDescriptionInit {
    if (!enabled || !value.sdp || value.type === "rollback") return value;
    return { type: value.type, sdp: stereoSdp(value.sdp, settings.store.bitrate) };
}

export default definePlugin({
    name: "StereoMic",
    description: "Experimental stereo microphone capture and Opus negotiation for Equibop/WebRTC. Requires a stereo input.",
    authors: [{ name: "Noah", id: 0n }],
    tags: ["Voice"],
    settings,

    start() {
        if (enabled) return;
        if (!IS_EQUIBOP || typeof RTCPeerConnection === "undefined" || !navigator.mediaDevices?.getUserMedia) {
            logger.error("WebRTC is unavailable. This plugin requires Equibop's web audio path.");
            return;
        }
        enabled = true;
        try {
            wrap(navigator.mediaDevices, "getUserMedia", original => async function (this: MediaDevices, constraints) {
                const stream = await original.call(this, enabled && constraints
                    ? stereoConstraints(constraints, settings.store)
                    : constraints);
                if (enabled) for (const track of stream.getAudioTracks()) {
                    const { channelCount, sampleRate, echoCancellation, noiseSuppression, autoGainControl } = track.getSettings();
                    logger.info("Captured input (does not prove transmitted stereo):", {
                        channelCount, sampleRate, echoCancellation, noiseSuppression, autoGainControl
                    });
                    if (channelCount !== 2) logger.warn("Input did not report two channels. Check your input device and PipeWire routing.");
                }
                return stream;
            });

            const proto = RTCPeerConnection.prototype;
            // Discord may construct descriptions itself or use createOffer/createAnswer.
            for (const key of ["createOffer", "createAnswer"] as const) {
                wrap(proto, key, original => (function (this: RTCPeerConnection, ...args: unknown[]) {
                    if (typeof args[0] === "function") {
                        const success = args[0] as (value: RTCSessionDescriptionInit) => void;
                        args[0] = (value: RTCSessionDescriptionInit) => success(description(value));
                        return Reflect.apply(original, this, args);
                    }
                    const result = Reflect.apply(original, this, args) as Promise<RTCSessionDescriptionInit>;
                    return result.then(description);
                }) as typeof original);
            }
            for (const key of ["setLocalDescription", "setRemoteDescription"] as const) {
                wrap(proto, key, original => (function (this: RTCPeerConnection, ...args: unknown[]) {
                    // Preserve optional arguments and legacy callbacks. The remote
                    // receive preference controls our Opus sender's stereo mode.
                    if (args[0]) args[0] = description(args[0] as RTCSessionDescriptionInit);
                    return Reflect.apply(original, this, args);
                }) as typeof original);
            }
            logger.info("Enabled. Leave and rejoin voice to apply. Verify left/right separation with a listener.");
        } catch (error) {
            this.stop();
            throw error;
        }
    },

    stop() {
        enabled = false;
        for (const cleanup of cleanups.reverse()) cleanup();
        cleanups = [];
        logger.info("Disabled. Leave and rejoin voice to reset existing tracks and negotiated audio.");
    }
});
