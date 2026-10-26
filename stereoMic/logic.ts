export interface StereoOptions {
    bitrate: number;
    disableProcessing: boolean;
}

export function stereoConstraints(constraints: MediaStreamConstraints, options: StereoOptions): MediaStreamConstraints {
    if (!constraints.audio) return constraints;
    return {
        ...constraints,
        audio: {
            ...(typeof constraints.audio === "object" ? constraints.audio : {}),
            channelCount: { ideal: 2 },
            ...(options.disableProcessing ? {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            } : {})
        }
    };
}

// Only touch Opus payloads in audio sections. Preserve video and other codecs.
export function stereoSdp(sdp: string, bitrate: number): string {
    const newline = sdp.includes("\r\n") ? "\r\n" : "\n";
    const lines = sdp.split(newline);
    let audio = false;
    let start = 0;
    const sections: string[][] = [];
    for (let i = 0; i <= lines.length; i++) {
        if (i === lines.length || lines[i].startsWith("m=")) {
            const section = lines.slice(start, i);
            if (audio) {
                const payloads = section.flatMap(line => {
                    const match = /^a=rtpmap:(\d+) opus\/48000\/2$/i.exec(line);
                    return match ? [match[1]] : [];
                });
                for (const payload of payloads) {
                    const prefix = `a=fmtp:${payload} `;
                    const index = section.findIndex(line => line.startsWith(prefix));
                    const params = new Map<string, string>();
                    if (index !== -1) {
                        for (const part of section[index].slice(prefix.length).split(";")) {
                            const [key, ...value] = part.trim().split("=");
                            if (key) params.set(key.toLowerCase(), value.join("="));
                        }
                    }
                    params.set("stereo", "1");
                    params.set("sprop-stereo", "1");
                    params.set("maxaveragebitrate", String(bitrate));
                    const line = prefix + [...params].map(([key, value]) => `${key}=${value}`).join(";");
                    if (index !== -1) section[index] = line;
                    else section.splice(section.findIndex(line => line.startsWith(`a=rtpmap:${payload} `)) + 1, 0, line);
                }
            }
            sections.push(section);
            start = i;
            audio = i < lines.length && lines[i].startsWith("m=audio ");
        }
    }
    return sections.flat().join(newline);
}
