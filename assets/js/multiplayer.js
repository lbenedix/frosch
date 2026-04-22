const MP_LOG_PREFIX = "[mp]";
const MP_DEBUG = new URL(location.href).searchParams.get("debug") === "1" || localStorage.getItem("frogDebug") === "1";

function mpDebug(msg, extra) {
    if (!MP_DEBUG) return;
    if (extra !== undefined) console.debug(MP_LOG_PREFIX, msg, extra);
    else console.debug(MP_LOG_PREFIX, msg);
}

function mpInfo(msg, extra) {
    if (extra !== undefined) console.info(MP_LOG_PREFIX, msg, extra);
    else console.info(MP_LOG_PREFIX, msg);
}

function mpWarn(msg, extra) {
    if (extra !== undefined) console.warn(MP_LOG_PREFIX, msg, extra);
    else console.warn(MP_LOG_PREFIX, msg);
}

(function initMultiplayer() {
    const panelEl = document.getElementById("mpPanel");
    const toggleBtn = document.getElementById("mpToggle");
    const nameEl = document.getElementById("mpName");
    const roomEl = document.getElementById("mpRoom");
    const joinBtn = document.getElementById("mpJoin");
    const leaveBtn = document.getElementById("mpLeave");
    const statusEl = document.getElementById("mpStatus");
    const scoresEl = document.getElementById("mpScores");

    if (!panelEl || !toggleBtn || !nameEl || !roomEl || !joinBtn || !leaveBtn || !statusEl || !scoresEl) {
        mpWarn("Multiplayer-Panel ist unvollstaendig.");
        return;
    }

    const panelStateKey = "frogMpPanelOpen";
    function setPanelOpen(open) {
        panelEl.classList.toggle("is-open", open);
        panelEl.setAttribute("aria-hidden", open ? "false" : "true");
        toggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
        toggleBtn.title = open ? "Multiplayer ausblenden" : "Multiplayer anzeigen";
        localStorage.setItem(panelStateKey, open ? "1" : "0");
    }

    setPanelOpen(localStorage.getItem(panelStateKey) === "1");
    toggleBtn.addEventListener("click", () => {
        const open = !panelEl.classList.contains("is-open");
        setPanelOpen(open);
    });

    const playerId = (() => {
        const key = "frogMpPlayerId";
        const existing = localStorage.getItem(key);
        if (existing) return existing;
        const generated = `p_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
        localStorage.setItem(key, generated);
        return generated;
    })();

    nameEl.value = localStorage.getItem("frogMpName") || "";
    roomEl.value = localStorage.getItem("frogMpRoom") || "";

    const state = {
        connected: false,
        room: "",
        name: "",
        pollHandle: null,
        timeLeft: 0,
    };

    function setStatus(text) {
        statusEl.textContent = text;
    }

    function sanitizeRoom(input) {
        return String(input || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 12);
    }

    function sanitizeName(input) {
        return String(input || "").trim().slice(0, 18);
    }

    async function postJson(path, payload) {
        const res = await fetch(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
            const msg = data.error || `HTTP ${res.status}`;
            throw new Error(msg);
        }
        return data;
    }

    async function pollState() {
        if (!state.connected) return;
        try {
            const q = new URLSearchParams({ room: state.room, playerId }).toString();
            const res = await fetch(`./api/state.php?${q}`);
            const data = await res.json();
            if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
            renderState(data.state);
        } catch (err) {
            mpWarn("Polling fehlgeschlagen.", err);
            setStatus("Verbindung holpert…");
        }
    }

    function renderState(serverState) {
        if (!serverState) return;
        state.timeLeft = serverState.timeLeft || 0;
        const players = Array.isArray(serverState.players) ? serverState.players : [];
        const running = serverState.running;
        setStatus(`${state.room} · ${running ? `Laeuft (${Math.ceil(state.timeLeft)}s)` : "Wartet auf Swats"}`);

        scoresEl.innerHTML = "";
        if (!players.length) return;
        players.sort((a, b) => b.score - a.score);
        for (const p of players) {
            const li = document.createElement("li");
            const isYou = p.id === playerId;
            li.innerHTML = `<span class="${isYou ? "you" : ""}">${isYou ? "Du" : p.name}</span><strong>${p.score}</strong>`;
            scoresEl.appendChild(li);
        }
    }

    async function joinRoom() {
        const room = sanitizeRoom(roomEl.value);
        const name = sanitizeName(nameEl.value) || `Player-${playerId.slice(-4)}`;
        if (!room) {
            setStatus("Bitte Raumcode eingeben.");
            return;
        }

        try {
            const data = await postJson("./api/join.php", { room, name, playerId });
            state.connected = true;
            state.room = room;
            state.name = name;
            localStorage.setItem("frogMpName", name);
            localStorage.setItem("frogMpRoom", room);
            renderState(data.state);
            if (state.pollHandle) clearInterval(state.pollHandle);
            state.pollHandle = setInterval(pollState, 800);
            setPanelOpen(true);
            mpInfo("Raum beigetreten.", { room, playerId });
        } catch (err) {
            mpWarn("Raumbeitritt fehlgeschlagen.", err);
            setStatus(`Join fehlgeschlagen: ${err.message}`);
        }
    }

    function leaveRoom() {
        state.connected = false;
        state.room = "";
        if (state.pollHandle) {
            clearInterval(state.pollHandle);
            state.pollHandle = null;
        }
        scoresEl.innerHTML = "";
        setStatus("Nicht verbunden");
    }

    async function sendSwat(delta) {
        if (!state.connected || !state.room) return;
        try {
            await postJson("./api/swat.php", {
                room: state.room,
                playerId,
                name: state.name,
                points: delta,
            });
            mpDebug("Swat an Server gesendet.", { delta });
        } catch (err) {
            mpWarn("Swat konnte nicht gesendet werden.", err);
        }
    }

    joinBtn.addEventListener("click", joinRoom);
    leaveBtn.addEventListener("click", leaveRoom);

    window.addEventListener("frog:player-swat", (event) => {
        const delta = Number(event.detail && event.detail.delta);
        if (!Number.isFinite(delta) || delta === 0) return;
        sendSwat(delta);
    });

    window.addEventListener("frog:match-end", () => {
        if (!state.connected) return;
        pollState();
    });

    mpInfo("Multiplayer-Client initialisiert.");
})();

