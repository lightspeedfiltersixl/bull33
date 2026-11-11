// younis Screen Solver (In-Tab Bookmarklet Engine)
(function() {
    if (document.getElementById("younis-in-tab-hud")) {
        document.getElementById("younis-in-tab-hud").style.display = "flex";
        return;
    }

    var AI_KEY = atob("c2stb3ItdjEtZmUwMTZlNDlmNmZlMWY2ZjVlNzE2YTdlOWExYWQ1YWMzNzdmNDZmZWYyOTAxNzkzMzY3N2YwYThlYjU2MThjZA==");
    var VISION_MODELS = [
        "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
        "google/gemma-4-31b-it:free",
        "google/gemma-4-26b-a4b-it:free",
        "nvidia/nemotron-3.5-super-vl:free",
        "dots-studio/dots-3-note-preview:free"
    ];

    var hud = document.createElement("div");
    hud.id = "younis-in-tab-hud";
    hud.style.cssText = "position:fixed;top:40px;right:20px;width:420px;max-width:calc(100vw - 32px);max-height:calc(100vh - 60px);background:#050507;border:1px solid rgba(255,255,255,0.14);border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,0.92);display:flex;flex-direction:column;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#ffffff;overflow:hidden;";

    hud.innerHTML = `
        <div id="younis-drag-bar" style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#0a0a0e;border-bottom:1px solid rgba(255,255,255,0.08);cursor:grab;user-select:none;">
            <div style="display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:700;color:#e5e5ea;">
                <span style="color:#d2b8ff">⚡</span>
                <span>younis solver</span>
            </div>
            <button id="younis-btn-x" style="width:26px;height:26px;border:0;background:transparent;color:#a09fa8;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;">✕</button>
        </div>
        <div style="padding:14px;display:flex;flex-direction:column;gap:10px;overflow-y:auto;max-height:calc(100vh - 120px);">
            <input id="younis-hud-input" type="text" placeholder="Ask about what's on your screen..." style="width:100%;height:40px;background:#121216;border:1px solid #282832;border-radius:10px;color:#ffffff;font-size:13.5px;padding:0 12px;box-sizing:border-box;outline:none;" />
            <div style="display:flex;align-items:center;gap:10px;">
                <button id="younis-hud-solve" style="background:#ffffff;color:#000000;font-size:14px;font-weight:700;padding:9px 18px;border-radius:10px;border:0;cursor:pointer;">Solve question</button>
                <button id="younis-hud-close" style="background:#181820;color:#ffffff;font-size:14px;font-weight:600;padding:9px 18px;border-radius:10px;border:1px solid #282835;cursor:pointer;">Close</button>
            </div>
            <div id="younis-video-box" style="position:relative;width:100%;height:140px;background:#000;border:1px solid rgba(255,255,255,0.08);border-radius:10px;overflow:hidden;display:none;align-items:center;justify-content:center;">
                <video id="younis-hud-video" autoplay playsinline muted style="width:100%;height:100%;object-fit:contain;"></video>
            </div>
            <div id="younis-hud-result" style="display:none;background:#111018;border:1px solid rgba(210,184,255,0.35);border-radius:10px;padding:12px;flex-direction:column;gap:8px;">
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <span id="younis-hud-badge" style="font-size:12px;font-weight:700;color:#a7f3d0;background:rgba(16,185,129,0.15);padding:3px 8px;border-radius:6px;">⚡ AI Solution</span>
                    <button id="younis-hud-copy" style="font-size:11.5px;background:rgba(255,255,255,0.08);color:#e5e5ea;border:0;border-radius:6px;padding:4px 8px;cursor:pointer;">Copy</button>
                </div>
                <div id="younis-hud-answer" style="font-size:13.5px;line-height:1.5;color:#f3f3f5;max-height:200px;overflow-y:auto;white-space:pre-wrap;word-break:break-word;"></div>
            </div>
        </div>
    `;

    document.body.appendChild(hud);

    var videoBox = hud.querySelector("#younis-video-box");
    var video = hud.querySelector("#younis-hud-video");
    var solveBtn = hud.querySelector("#younis-hud-solve");
    var closeBtn = hud.querySelector("#younis-hud-close");
    var xBtn = hud.querySelector("#younis-btn-x");
    var input = hud.querySelector("#younis-hud-input");
    var resPanel = hud.querySelector("#younis-hud-result");
    var badge = hud.querySelector("#younis-hud-badge");
    var ansBox = hud.querySelector("#younis-hud-answer");
    var copyBtn = hud.querySelector("#younis-hud-copy");
    var dragBar = hud.querySelector("#younis-drag-bar");

    var stream = null;

    closeBtn.onclick = xBtn.onclick = function() {
        hud.style.display = "none";
    };

    copyBtn.onclick = function() {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(ansBox.innerText || ansBox.textContent);
            copyBtn.textContent = "Copied!";
            setTimeout(function() { copyBtn.textContent = "Copy"; }, 1500);
        }
    };

    // Dragging
    var isDragging = false, startX, startY, origX, origY;
    dragBar.onpointerdown = function(e) {
        if (e.target.tagName === "BUTTON") return;
        isDragging = true;
        dragBar.style.cursor = "grabbing";
        startX = e.clientX;
        startY = e.clientY;
        var r = hud.getBoundingClientRect();
        origX = r.left;
        origY = r.top;
        hud.style.left = origX + "px";
        hud.style.top = origY + "px";
        hud.style.right = "auto";
        dragBar.setPointerCapture(e.pointerId);
    };
    dragBar.onpointermove = function(e) {
        if (!isDragging) return;
        hud.style.left = Math.max(8, origX + e.clientX - startX) + "px";
        hud.style.top = Math.max(8, origY + e.clientY - startY) + "px";
    };
    dragBar.onpointerup = function(e) {
        if (!isDragging) return;
        isDragging = false;
        dragBar.style.cursor = "grab";
        try { dragBar.releasePointerCapture(e.pointerId); } catch(err){}
    };

    async function ensureStream() {
        if (stream) return true;
        try {
            var s = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: "always", displaySurface: "browser" },
                audio: false
            });
            stream = s;
            video.srcObject = s;
            videoBox.style.display = "flex";
            s.getVideoTracks()[0].onended = function() {
                stream = null;
                videoBox.style.display = "none";
            };
            return true;
        } catch(err) {
            alert("Screenshare cancelled or failed: " + err);
            return false;
        }
    }

    solveBtn.onclick = async function() {
        var ok = await ensureStream();
        if (!ok) return;

        solveBtn.disabled = true;
        solveBtn.textContent = "⚡ Solving...";
        resPanel.style.display = "flex";
        ansBox.innerHTML = "<div style='color:#d2b8ff'>⚡ Scanning screen & calculating exact answer...</div>";
        badge.textContent = "⚡ Solving...";

        var vw = video.videoWidth || 1920;
        var vh = video.videoHeight || 1080;
        var cv = document.createElement("canvas");
        cv.width = vw;
        cv.height = vh;
        cv.getContext("2d").drawImage(video, 0, 0, vw, vh);
        var frame = cv.toDataURL("image/jpeg", 0.90);

        var userQ = (input.value || "").trim();
        var sysPrompt = 
            "You are an elite academic visual tutor and question solver for i-Ready and tests.\n" +
            "Analyze every pixel with 100% precision.\n" +
            "Rules:\n" +
            "1. Output the final correct answer in bold at the very top: '**ANSWER: [Option Letter or Value]**'.\n" +
            "2. Give a concise 1-2 sentence verification below.\n" +
            "3. Guarantee 100% accuracy.";

        var t0 = performance.now();
        var full = "";

        for (var i = 0; i < VISION_MODELS.length; i++) {
            var model = VISION_MODELS[i];
            try {
                var resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": "Bearer " + AI_KEY,
                        "Content-Type": "application/json",
                        "HTTP-Referer": location.origin || "http://localhost",
                        "X-Title": "younis"
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            { role: "system", content: sysPrompt },
                            { role: "user", content: [
                                { type: "text", text: userQ ? (userQ + "\nSolve accurately.") : "Solve the question shown with 100% precision." },
                                { type: "image_url", image_url: { url: frame } }
                            ]}
                        ],
                        stream: true
                    })
                });

                if (!resp.ok || !resp.body) continue;

                var reader = resp.body.getReader();
                var decoder = new TextDecoder();
                var buf = "";
                ansBox.innerHTML = "";

                while (true) {
                    var chunk = await reader.read();
                    if (chunk.done) break;
                    buf += decoder.decode(chunk.value, { stream: true });
                    var lines = buf.split(/\r?\n/);
                    buf = lines.pop() || "";
                    for (var li = 0; li < lines.length; li++) {
                        var l = lines[li].trim();
                        if (!l.startsWith("data:")) continue;
                        var dStr = l.slice(5).trim();
                        if (dStr === "[DONE]") break;
                        try {
                            var p = JSON.parse(dStr);
                            var delta = p.choices && p.choices[0] && p.choices[0].delta;
                            var c = (delta && delta.content) || (p.choices && p.choices[0] && p.choices[0].message && p.choices[0].message.content);
                            if (c) {
                                full += c;
                                var match = full.match(/\*\*ANSWER:\s*([^\*]+)\*\*/i) || full.match(/^ANSWER:\s*([^\n]+)/i);
                                if (match) {
                                    var ans = match[1].trim();
                                    var rest = full.replace(match[0], "").trim();
                                    ansBox.innerHTML = "<div style='font-size:15px;font-weight:800;color:#34d399;background:rgba(16,185,129,0.14);border-left:3px solid #10b981;padding:6px 10px;border-radius:6px;margin-bottom:4px;'>✔ Correct Answer: " + ans + "</div><div>" + rest + "</div>";
                                } else {
                                    ansBox.textContent = full;
                                }
                            }
                        } catch(err) {}
                    }
                }

                if (full) {
                    var sec = ((performance.now() - t0) / 1000).toFixed(1);
                    badge.textContent = "⚡ Solved in " + sec + "s";
                    solveBtn.disabled = false;
                    solveBtn.textContent = "Solve question";
                    return;
                }
            } catch(e) {}
        }

        badge.textContent = "⚠️ Error";
        ansBox.textContent = "Could not solve. Please try again.";
        solveBtn.disabled = false;
        solveBtn.textContent = "Solve question";
    };
})();
