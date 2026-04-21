/* =====================================================
   🎮 THE FROG GAME — Arcade Edition
   ===================================================== */
(() => {
	// ---- DOM refs ----
	const frogScene = document.querySelector(".frog-scene");
	const frogBody = document.querySelector(".frog-body");
	const belly = document.getElementById("belly");
	const pupilL = document.getElementById("pupilL");
	const pupilR = document.getElementById("pupilR");
	const tonguePath = document.getElementById("tonguePath");
	const tongueTip = document.getElementById("tongueTip");
	const scoreEl = document.getElementById("hudScore");
	const bestEl = document.getElementById("hudBest");
	const comboEl = document.getElementById("hudCombo");
	const frogHudEl = document.getElementById("hudFrog");
	const timeEl = document.getElementById("hudTime");
	// Modal refs
	const moBackdrop = document.getElementById("gameOverModal");
	const moTitle = document.getElementById("moTitle");
	const moPlayer = document.getElementById("moPlayer");
	const moFrog = document.getElementById("moFrog");
	const moPlayerCol = document.getElementById("moPlayerCol");
	const moFrogCol = document.getElementById("moFrogCol");
	const moStats = document.getElementById("moStats");
	const moShare = document.getElementById("moShare");
	const moReplay = document.getElementById("moReplay");
	const moExit = document.getElementById("moExit");

	// Remove the static fly/splat elements — we'll spawn dynamically
	const oldFly = document.getElementById("fly");
	if (oldFly) oldFly.remove();
	const oldSplat = document.getElementById("splat");
	if (oldSplat) oldSplat.remove();

	const reducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;

	// ---- Audio engine (Web Audio synth — no external files) ----
	let audioCtx = null;
	// Default: MUTED. Users can opt-in via the toggle; choice is persisted.
	let muted = localStorage.getItem("frogMuted") !== "0";
	const soundBtn = document.getElementById("soundToggle");
	function refreshSoundBtn() {
		soundBtn.textContent = muted ? "🔇" : "🔊";
		soundBtn.classList.toggle("muted", muted);
	}
	refreshSoundBtn();
	soundBtn.addEventListener("click", () => {
		muted = !muted;
		localStorage.setItem("frogMuted", muted ? "1" : "0");
		refreshSoundBtn();
		// Wake AudioContext on the user gesture so unmuting works immediately
		if (!muted) {
			const ac = audio();
			if (ac && ac.state === "suspended") ac.resume();
		}
	});

	function audio() {
		if (!audioCtx) {
			try {
				audioCtx = new (window.AudioContext || window.webkitAudioContext)();
			} catch (e) {
				return null;
			}
		}
		return audioCtx;
	}
	function beep(freq, dur, type = "sine", vol = 0.08) {
		if (!game.started || muted) return; // 🤫 silence until unlocked, or muted by user
		const ac = audio();
		if (!ac) return;
		const o = ac.createOscillator();
		const g = ac.createGain();
		o.type = type;
		o.frequency.setValueAtTime(freq, ac.currentTime);
		g.gain.setValueAtTime(vol, ac.currentTime);
		g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
		o.connect(g);
		g.connect(ac.destination);
		o.start();
		o.stop(ac.currentTime + dur);
	}
	const sfx = {
		splat: () => {
			beep(180, 0.08, "square", 0.12);
			setTimeout(() => beep(80, 0.12, "square", 0.1), 40);
		},
		gulp: () => {
			beep(220, 0.12, "sine", 0.1);
			setTimeout(() => beep(330, 0.18, "sine", 0.12), 80);
		},
		miss: () => {
			beep(180, 0.08, "sawtooth", 0.06);
		},
		golden: () => {
			for (let i = 0; i < 5; i++)
				setTimeout(() => beep(660 + i * 90, 0.08, "triangle", 0.08), i * 45);
		},
		burp: () => {
			beep(90, 0.22, "sawtooth", 0.1);
		},
		combo: (n) => {
			beep(440 + Math.min(20, n) * 40, 0.06, "triangle", 0.07);
		},
		frenzy: () => {
			for (let i = 0; i < 10; i++)
				setTimeout(
					() => beep(440 + Math.random() * 440, 0.08, "sine", 0.08),
					i * 45,
				);
		},
		sting: () => {
			beep(880, 0.05, "square", 0.1);
			setTimeout(() => beep(660, 0.08, "square", 0.1), 50);
		},
	};

	// ---- Game state ----
	const game = {
		playerScore: 0,
		frogScore: 0,
		best: parseInt(localStorage.getItem("frogHighScore") || "0", 10),
		combo: 1,
		comboTimer: 0,
		bestCombo: 1,
		flies: [],
		particles: [],
		frenzy: false,
		frenzyTimer: 0,
		bellyBoost: 1,
		started: false,
		everStarted: false, // sticky once the player has unlocked it once
		// 🔗 Challenge link: visiting `?play=1` skips the discovery delay so a
		// shared opponent finds a fly waiting for them right away.
		...(new URL(location.href).searchParams.get("play")
			? { everStarted: true }
			: {}),
		timeLeft: 60,
		timeUp: false,
		lastLeader: null,
	};
	const MATCH_DURATION = 30; // seconds
	bestEl.textContent = game.best;
	const hudEl = document.querySelector(".hud");
	const leadValEl = document.getElementById("hudLeadVal");

	// ---- Tunables ----
	const isTouch = window.matchMedia("(pointer: coarse)").matches;
	const SCARE_RADIUS = 140;
	const SCARE_FORCE = 1800;
	const HAND_ON_RADIUS = 160;
	const HAND_OFF_RADIUS = 200;
	// 📱 On touch devices a fingertip is huge → smaller hitbox to keep it challenging
	const SWAT_RADIUS = isTouch ? 22 : 30;
	const SNATCH_RADIUS = 230; // ⬆️ frog reaches further
	const ANTICIPATE_DUR = 0.12; // ⬇️ frog telegraphs faster
	const SHOOT_DUR = 0.09; // ⬇️ tongue snaps quicker
	const RETRACT_DUR = 0.2;
	const MISS_RETRACT = 0.16;
	const COOLDOWN = 0.35; // ⬇️ frog ready again sooner
	const MISS_PROB = 0.15; // ⬇️ frog whiffs less often
	const FROG_ATTACK_RATE = 3.0; // strikes per second when fly in range
	// 🎯 Combo multiplier is capped so the player can't run away with the score
	const COMBO_CAP = 5;

	let mouseX = -9999,
		mouseY = -9999,
		mouseActive = false;
	let handActive = false;

	window.addEventListener(
		"mousemove",
		(e) => {
			mouseX = e.clientX;
			mouseY = e.clientY;
			mouseActive = true;
		},
		{ passive: true },
	);
	window.addEventListener("mouseleave", () => {
		mouseActive = false;
	});

	// ---- Helpers ----
	function mouthPos() {
		const r = frogScene.getBoundingClientRect();
		return {
			x: r.left + r.width * (150 / 300),
			y: r.top + r.height * (95 / 150),
		};
	}
	function setTongue(mx, my, tx, ty, opacity) {
		if (opacity <= 0) {
			tonguePath.style.opacity = 0;
			tongueTip.style.opacity = 0;
			return;
		}
		const cx = (mx + tx) / 2;
		const cy = Math.min(my, ty) - 40;
		tonguePath.setAttribute("d", `M${mx},${my} Q${cx},${cy} ${tx},${ty}`);
		tonguePath.style.opacity = opacity;
		tongueTip.setAttribute("cx", tx);
		tongueTip.setAttribute("cy", ty);
		tongueTip.style.opacity = opacity;
	}

	// ---- Fly ----
	class Fly {
		constructor(type = "normal") {
			this.type = type; // 'normal' | 'golden' | 'angry'
			this.alive = true;
			this.beingEaten = false;
			this.vx = 0;
			this.vy = 0;
			this.angle = 0;
			this.opacity = 1;
			this.scale = 1;
			// 🔍 Random size — small flies are harder to swat → worth more points
			this.sizeScale = 0.7 + Math.random() * 0.6; // 0.7 .. 1.3
			this.el = document.createElement("div");
			this.el.className =
				"fly" +
				(type === "golden" ? " golden" : type === "angry" ? " angry" : "");
			this.el.textContent =
				type === "golden" ? "🪲" : type === "angry" ? "🐝" : "🪰";
			document.body.appendChild(this.el);
			// spawn from random edge
			const side = Math.floor(Math.random() * 4);
			if (side === 0) {
				this.x = -30;
				this.y = Math.random() * window.innerHeight;
			} else if (side === 1) {
				this.x = window.innerWidth + 30;
				this.y = Math.random() * window.innerHeight;
			} else if (side === 2) {
				this.x = Math.random() * window.innerWidth;
				this.y = -30;
			} else {
				this.x = Math.random() * window.innerWidth;
				this.y = window.innerHeight + 30;
			}
			this.pickTarget();
			this.maxSpeed = type === "golden" ? 560 : type === "angry" ? 520 : 420;
			// Smaller flies → small bonus; bigger flies → small malus (size 0.7 → +30%, 1.3 → -30%)
			const sizeBonus = 1 + (1 - this.sizeScale);
			// Player base points (will be multiplied by combo, capped)
			this.points = Math.round(
				(type === "golden" ? 50 : type === "angry" ? 20 : 10) * sizeBonus,
			);
			// Frog gets ~the same base — no combo, but every snatch is a real point grab.
			this.frogPoints = Math.round(
				(type === "golden" ? 60 : type === "angry" ? 18 : 12) * sizeBonus,
			);
		}
		pickTarget() {
			const pad = 30;
			this.tx = pad + Math.random() * (window.innerWidth - pad * 2);
			this.ty = pad + Math.random() * (window.innerHeight - pad * 2);
			this.targetTimer = 0.8 + Math.random() * 1.4;
		}
		destroy() {
			this.alive = false;
			if (this.el && this.el.parentNode)
				this.el.parentNode.removeChild(this.el);
		}
		update(dt) {
			if (!this.alive || this.beingEaten) return;
			const dx = this.tx - this.x,
				dy = this.ty - this.y;
			this.vx += dx * 2.0 * dt;
			this.vy += dy * 2.0 * dt;
			const jitterScale = reducedMotion ? 0.3 : 1;
			this.vx += (Math.random() - 0.5) * 260 * dt * jitterScale;
			this.vy += (Math.random() - 0.5) * 260 * dt * jitterScale;

			// Angry bee CHASES the mouse instead of running away!
			if (this.type === "angry" && mouseActive) {
				const adx = mouseX - this.x,
					ady = mouseY - this.y;
				const adl = Math.hypot(adx, ady) || 1;
				if (adl < 400) {
					this.vx += (adx / adl) * 650 * dt;
					this.vy += (ady / adl) * 650 * dt;
				}
			} else if (mouseActive) {
				const mdx = this.x - mouseX,
					mdy = this.y - mouseY;
				const md2 = mdx * mdx + mdy * mdy;
				const R2 = SCARE_RADIUS * SCARE_RADIUS;
				if (md2 < R2 && md2 > 0.01) {
					const md = Math.sqrt(md2);
					const falloff = 1 - md / SCARE_RADIUS;
					const accel = SCARE_FORCE * falloff * falloff;
					this.vx += (mdx / md) * accel * dt;
					this.vy += (mdy / md) * accel * dt;
					if (md < SCARE_RADIUS * 0.5) {
						this.tx = this.x + (mdx / md) * (200 + Math.random() * 200);
						this.ty = this.y + (mdy / md) * (200 + Math.random() * 200);
						this.tx = Math.max(30, Math.min(window.innerWidth - 30, this.tx));
						this.ty = Math.max(30, Math.min(window.innerHeight - 30, this.ty));
					}
				}
			}

			this.vx *= 0.94;
			this.vy *= 0.94;
			const sp = Math.hypot(this.vx, this.vy);
			const cap = (reducedMotion ? 180 : this.maxSpeed) * 2.2;
			if (sp > cap) {
				this.vx = (this.vx / sp) * cap;
				this.vy = (this.vy / sp) * cap;
			}

			this.x += this.vx * dt;
			this.y += this.vy * dt;

			if (this.x < 10) {
				this.x = 10;
				this.vx = Math.abs(this.vx);
				this.pickTarget();
			}
			if (this.x > window.innerWidth - 10) {
				this.x = window.innerWidth - 10;
				this.vx = -Math.abs(this.vx);
				this.pickTarget();
			}
			if (this.y < 10) {
				this.y = 10;
				this.vy = Math.abs(this.vy);
				this.pickTarget();
			}
			if (this.y > window.innerHeight - 10) {
				this.y = window.innerHeight - 10;
				this.vy = -Math.abs(this.vy);
				this.pickTarget();
			}

			this.targetTimer -= dt;
			if (this.targetTimer <= 0 || Math.hypot(dx, dy) < 20) this.pickTarget();

			const speed = Math.hypot(this.vx, this.vy);
			if (speed > 15) {
				const ta = (Math.atan2(this.vy, this.vx) * 180) / Math.PI + 90;
				const d = ((ta - this.angle + 540) % 360) - 180;
				this.angle += d * Math.min(1, dt * 12);
			}
		}
		render() {
			if (!this.alive) return;
			const typeMul = this.type === "golden" ? 1.2 : 1;
			const s = this.scale * typeMul * this.sizeScale;
			this.el.style.transform = `translate(${this.x - 11}px, ${this.y - 11}px) rotate(${this.angle}deg) scale(${s})`;
			this.el.style.opacity = this.opacity;
		}
	}

	// ---- Particles ----
	class Particle {
		constructor(x, y, color, vx, vy) {
			this.x = x;
			this.y = y;
			this.vx = vx;
			this.vy = vy;
			this.life = 1;
			this.maxLife = 0.6 + Math.random() * 0.4;
			this.el = document.createElement("div");
			this.el.className = "particle";
			this.el.style.background = color;
			document.body.appendChild(this.el);
		}
		update(dt) {
			this.x += this.vx * dt;
			this.y += this.vy * dt;
			this.vy += 600 * dt; // gravity
			this.vx *= 0.98;
			this.life -= dt / this.maxLife;
		}
		render() {
			this.el.style.transform = `translate(${this.x - 3}px, ${this.y - 3}px) scale(${this.life})`;
			this.el.style.opacity = this.life;
		}
		destroy() {
			if (this.el && this.el.parentNode)
				this.el.parentNode.removeChild(this.el);
		}
	}
	function spawnParticles(x, y, count, palette) {
		for (let i = 0; i < count; i++) {
			const ang = Math.random() * Math.PI * 2;
			const sp = 150 + Math.random() * 300;
			const c = palette[Math.floor(Math.random() * palette.length)];
			game.particles.push(
				new Particle(x, y, c, Math.cos(ang) * sp, Math.sin(ang) * sp),
			);
		}
	}

	// ---- Floating score popup ----
	function scorePop(x, y, text, color = "#ffd54a") {
		const el = document.createElement("div");
		el.className = "score-pop";
		el.textContent = text;
		el.style.color = color;
		document.body.appendChild(el);
		const startT = performance.now();
		function anim(now) {
			const t = (now - startT) / 800;
			if (t >= 1) {
				el.remove();
				return;
			}
			el.style.transform = `translate(${x - 20}px, ${y - 10 - t * 60}px) scale(${1 + t * 0.3})`;
			el.style.opacity = 1 - t;
			requestAnimationFrame(anim);
		}
		requestAnimationFrame(anim);
	}

	// ---- Frog speech bubble ----
	function frogSays(text, durationMs = 900) {
		if (!game.started) return; // 🤫 silent until unlocked
		const el = document.createElement("div");
		el.className = "frog-say";
		el.textContent = text;
		document.body.appendChild(el);
		const r = frogScene.getBoundingClientRect();
		// Default: bubble pops up from above the frog's right cheek
		let x = r.left + r.width * 0.55;
		const y = r.top - 10;
		// 📱 Clamp inside the viewport so the bubble never runs off the edge on small screens
		const bw = el.offsetWidth || 200;
		const margin = 8;
		x = Math.max(margin, Math.min(window.innerWidth - bw - margin, x));
		const startT = performance.now();
		function anim(now) {
			const t = (now - startT) / durationMs;
			if (t >= 1) {
				el.remove();
				return;
			}
			el.style.transform = `translate(${x}px, ${y - t * 25}px) scale(${1 + t * 0.08})`;
			el.style.opacity = 1 - Math.max(0, t - 0.6) / 0.4;
			requestAnimationFrame(anim);
		}
		requestAnimationFrame(anim);
	}

	// ---- Screen shake ----
	function shake() {
		if (reducedMotion) return;
		document.body.classList.remove("shake");
		void document.body.offsetWidth;
		document.body.classList.add("shake");
		setTimeout(() => document.body.classList.remove("shake"), 400);
	}

	// ---- Splat visual ----
	function splatAt(x, y, emoji = "💥") {
		const el = document.createElement("div");
		el.className = "splat";
		el.textContent = emoji;
		el.style.setProperty("--sx", x - 16 + "px");
		el.style.setProperty("--sy", y - 16 + "px");
		document.body.appendChild(el);
		void el.offsetWidth;
		el.classList.add("active");
		setTimeout(() => el.remove(), 700);
	}

	// ---- Score / combo / HUD ----
	function updateHUD() {
		scoreEl.textContent = game.playerScore;
		frogHudEl.textContent = game.frogScore;
		comboEl.textContent = "×" + game.combo;
		timeEl.textContent = Math.max(0, Math.ceil(game.timeLeft));
		// Color the timer red in the last 10 seconds
		timeEl.style.color =
			game.timeLeft <= 10 && game.started ? "#ff8a65" : "#fff";
		const diff = game.playerScore - game.frogScore;
		leadValEl.textContent = (diff > 0 ? "+" : "") + diff;
		leadValEl.style.color =
			diff > 0 ? "#8bc34a" : diff < 0 ? "#ff8a65" : "#fff";
		if (game.playerScore > game.best) {
			game.best = game.playerScore;
			localStorage.setItem("frogHighScore", String(game.best));
			bestEl.textContent = game.best;
		}
		// Trash-talk when lead changes
		if (game.started) {
			const leader = diff > 0 ? "player" : diff < 0 ? "frog" : "tie";
			if (leader !== game.lastLeader && game.lastLeader !== null) {
				if (leader === "frog") frogSays("Hihi, ich führe! 🐸", 1000);
				else if (leader === "player") frogSays("Pff, Glück gehabt!", 1000);
			}
			game.lastLeader = leader;
		}
	}
	function addCombo() {
		game.combo = Math.min(99, game.combo + 1);
		if (game.combo > game.bestCombo) game.bestCombo = game.combo;
		game.comboTimer = 1.6; // shorter window keeps combos exciting but contested
		comboEl.classList.remove("hot");
		void comboEl.offsetWidth;
		comboEl.classList.add("hot");
		sfx.combo(game.combo);
		if (game.combo === 5) frogSays("Nice! 🔥");
		if (game.combo === 10) {
			frogSays("KOMBO-MEISTER! 💥");
			shake();
		}
		if (game.combo === 20) triggerFrenzy();
	}
	function resetCombo() {
		game.combo = 1;
		comboEl.classList.remove("hot");
	}

	// ---- 🤫 Secret unlock: first swat reveals the game ----
	function startGame() {
		if (game.started) return;
		game.started = true;
		game.everStarted = true; // skip the discovery delay on subsequent rounds
		startedAt = elapsed; // difficulty ramp begins now
		hudEl.classList.add("revealed");
		soundBtn.classList.add("in-game");
		// 🐸 Hide the affiliate UI — game time!
		document.querySelector(".card").classList.add("game-mode");
		// Wake up the audio context (must be triggered by a user gesture)
		const ac = audio();
		if (ac && ac.state === "suspended") ac.resume();
		// Fresh duel: reset both scores so the race starts fair
		game.playerScore = 0;
		game.frogScore = 0;
		game.bellyBoost = 1;
		game.lastLeader = null;
		game.combo = 1;
		game.bestCombo = 1;
		game.timeLeft = MATCH_DURATION;
		game.timeUp = false;
		updateHUD();
		frogSays(`🎮 ${MATCH_DURATION}s — Mensch gegen Frosch! 🐸`, 1800);
	}

	// ---- 🏁 End of match ----
	function endGame() {
		if (game.timeUp) return;
		game.timeUp = true;
		// Reset frog state and clear tongue, kill any flies still being eaten
		frog.state = "idle";
		frog.target = null;
		frog.stateT = 0;
		setTongue(0, 0, 0, 0, 0);
		frogBody.classList.remove("crouch");

		// Determine winner
		const p = game.playerScore,
			f = game.frogScore;
		const youWin = p > f,
			tie = p === f;
		moTitle.textContent = youWin
			? "🏆 Du gewinnst!"
			: tie
				? "🤝 Unentschieden!"
				: "🐸 Frosch gewinnt!";
		document.getElementById("moSubtitle").textContent =
			`${MATCH_DURATION} Sekunden Mensch gegen Frosch`;
		moPlayer.textContent = p;
		moFrog.textContent = f;
		moPlayerCol.classList.toggle("winner", youWin);
		moFrogCol.classList.toggle("winner", !youWin && !tie);
		moStats.textContent = `Beste Combo: ×${game.bestCombo} · Highscore: ${game.best}`;

		// Frog reaction
		if (youWin) {
			frogSays("Mensch! Glück gehabt 😤", 2000);
		} else if (tie) {
			frogSays("Patt! Nochmal? 🐸", 2000);
		} else {
			frogSays("Hahaha! Punktsieg für mich! 🐸✨", 2000);
			shake();
		}

		// Sound flourish
		if (youWin) sfx.golden();
		else if (!tie) sfx.frenzy();
		else sfx.combo(5);

		setTimeout(() => moBackdrop.classList.add("show"), 300);
	}

	// ---- 🔄 Replay ----
	function resetGame() {
		// Wipe flies, particles, tongue, frog state
		for (const f of game.flies) f.destroy();
		game.flies = [];
		for (const p of game.particles) p.destroy();
		game.particles = [];
		frog.state = "idle";
		frog.target = null;
		frog.stateT = 0;
		setTongue(0, 0, 0, 0, 0);
		frogBody.classList.remove("crouch");
		// Reset scores & timer
		game.playerScore = 0;
		game.frogScore = 0;
		game.combo = 1;
		game.bestCombo = 1;
		game.comboTimer = 0;
		game.bellyBoost = 1;
		game.lastLeader = null;
		game.timeLeft = MATCH_DURATION;
		game.timeUp = false;
		game.frenzy = false;
		game.frenzyTimer = 0;
		document.body.classList.remove("frenzy");
		startedAt = elapsed; // reset difficulty ramp
		spawnTimer = 0;
		moBackdrop.classList.remove("show");
		updateHUD();
		// Spawn a starter fly
		game.flies.push(new Fly("normal"));
	}
	moReplay.addEventListener("click", resetGame);

	// ---- 🚪 Exit: leave the game and return to the normal site ----
	function exitGame() {
		if (!game.started) return;
		// Wipe game world
		for (const f of game.flies) f.destroy();
		game.flies = [];
		for (const p of game.particles) p.destroy();
		game.particles = [];
		frog.state = "idle";
		frog.target = null;
		frog.stateT = 0;
		setTongue(0, 0, 0, 0, 0);
		frogBody.classList.remove("crouch");
		// Reset state — back to "secret/idle" mode
		game.started = false;
		game.timeUp = false;
		game.timeLeft = MATCH_DURATION;
		game.playerScore = 0;
		game.frogScore = 0;
		game.combo = 1;
		game.bestCombo = 1;
		game.comboTimer = 0;
		game.bellyBoost = 1;
		game.lastLeader = null;
		game.frenzy = false;
		game.frenzyTimer = 0;
		spawnTimer = 0;
		// Hide game UI, restore affiliate UI
		moBackdrop.classList.remove("show");
		hudEl.classList.remove("revealed");
		soundBtn.classList.remove("in-game");
		document.querySelector(".card").classList.remove("game-mode");
		document.body.classList.remove("frenzy");
		// Spawn the lonely starter fly again so the page looks alive
		game.flies.push(new Fly("normal"));
	}
	moExit.addEventListener("click", exitGame);

	// ⌨️ Escape always quits — whether you're mid-match or staring at the result
	window.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && game.started) {
			e.preventDefault();
			exitGame();
		}
	});

	// ---- 📤 Share result ----
	async function shareResult() {
		const p = game.playerScore,
			f = game.frogScore;
		const youWin = p > f,
			tie = p === f;
		const verdict = youWin
			? "🏆 GEWONNEN"
			: tie
				? "🤝 UNENTSCHIEDEN"
				: "😅 VERLOREN";
		// Visual progress bar showing the score split
		const total = Math.max(1, p + f);
		const barLen = 14;
		const youBars = Math.round((p / total) * barLen);
		const bar = "🟩".repeat(youBars) + "⬜".repeat(barLen - youBars);
		// Build a "challenge" URL — opening it skips the 30s discovery delay
		// so the recipient finds a fly waiting for them right away.
		const shareUrl = (() => {
			const u = new URL(location.href);
			u.searchParams.set("play", "1");
			return u.toString();
		})();
		const text = `🐸 FROG SMASH — ${MATCH_DURATION}s Duell
━━━━━━━━━━━━━━━━━
🎯 Du     ${String(p).padStart(4)}
🐸 Frosch ${String(f).padStart(4)}
${bar}
🔥 Beste Combo: ×${game.bestCombo}

${verdict}!
Schaffst du mehr? 👉 ${shareUrl}`;

		try {
			if (navigator.share) {
				await navigator.share({ title: "🐸 Frog Smash", text });
				return;
			}
		} catch (e) {
			/* user cancelled */
		}
		try {
			await navigator.clipboard.writeText(text);
			moShare.textContent = "✅ Kopiert!";
			setTimeout(() => (moShare.textContent = "📤 Teilen"), 1800);
		} catch (e) {
			alert(text);
		}
	}
	moShare.addEventListener("click", shareResult);

	// ---- Kill handlers ----
	function killFly(fly, cx, cy, byPlayer) {
		if (!fly.alive) return;

		// Before the game is unlocked: silently destroy, no scoring.
		if (!game.started && !byPlayer) {
			fly.destroy();
			return;
		}

		if (byPlayer) {
			if (fly.type === "angry") {
				// Stinging cost — more painful, breaks combo
				game.playerScore = Math.max(0, game.playerScore - 15);
				scorePop(cx, cy, "-15 AUA!", "#ff5252");
				resetCombo();
				sfx.sting();
				shake();
				spawnParticles(cx, cy, 12, ["#ff5252", "#ffb300", "#ff8a65"]);
				splatAt(cx, cy, "🤕");
			} else {
				// Combo multiplier is capped so the player can't snowball away
				const mult = Math.min(game.combo, COMBO_CAP);
				const pts = fly.points * mult;
				game.playerScore += pts;
				addCombo();
				const tag = mult > 1 ? `+${pts} ×${mult}` : `+${pts}`;
				scorePop(cx, cy, tag, fly.type === "golden" ? "#ffd54a" : "#8bc34a");
				if (fly.type === "golden") {
					sfx.golden();
					shake();
					spawnParticles(cx, cy, 28, [
						"#ffd54a",
						"#ffab00",
						"#fff59d",
						"#ffe082",
					]);
					splatAt(cx, cy, "✨");
				} else {
					sfx.splat();
					spawnParticles(cx, cy, 14, ["#689f38", "#33691e", "#c8e6a0"]);
					splatAt(cx, cy, "💥");
				}
			}
		} else {
			// Frog ate it — frog's points only
			game.frogScore += fly.frogPoints;
			sfx.gulp();
			if (Math.random() < 0.3) {
				const lines = [
					"Mjam!",
					"Burp! 💨",
					"Nom!",
					"Lecker!",
					"Hmm…",
					"Ribbit! 🐸",
					"Punkt für mich!",
				];
				setTimeout(() => {
					frogSays(lines[Math.floor(Math.random() * lines.length)], 900);
					sfx.burp();
				}, 300);
			}
			game.bellyBoost = Math.min(1.25, game.bellyBoost + 0.015);
		}
		fly.destroy();
		updateHUD();
	}

	// ---- Click to swat ----
	function trySwat(cx, cy) {
		if (game.timeUp) return false; // match is over
		let hit = null,
			best = Infinity;
		for (const f of game.flies) {
			if (!f.alive || f.beingEaten) continue;
			// Hitbox scales with the fly's size; clamp to a usable minimum
			const hitR = Math.max(18, SWAT_RADIUS * f.sizeScale);
			const d = Math.hypot(cx - f.x, cy - f.y);
			if (d <= hitR && d < best) {
				hit = f;
				best = d;
			}
		}
		if (hit) {
			if (!game.started) startGame(); // 🤫 reveal HUD + unlock sounds
			killFly(hit, cx, cy, true);
			// Cancel tongue if it was targeting this fly
			if (frog.target === hit) {
				frog.target = null;
				frog.state = "idle";
				setTongue(0, 0, 0, 0, 0);
				frogBody.classList.remove("crouch");
			}
			return true;
		}
		return false;
	}
	window.addEventListener("click", (e) => {
		trySwat(e.clientX, e.clientY);
	});
	window.addEventListener(
		"touchstart",
		(e) => {
			if (e.touches.length) trySwat(e.touches[0].clientX, e.touches[0].clientY);
		},
		{ passive: true },
	);

	// ---- Frog AI ----
	const frog = {
		state: "idle",
		stateT: 0,
		snatchX: 0,
		snatchY: 0,
		target: null,
		willMiss: false,
	};

	function updateFrog(dt) {
		if (game.timeUp) {
			setTongue(0, 0, 0, 0, 0);
			return;
		}
		const m = mouthPos();
		if (frog.state === "idle") {
			let best = null,
				bestD = Infinity;
			for (const f of game.flies) {
				if (!f.alive || f.beingEaten) continue;
				const d = Math.hypot(f.x - m.x, f.y - m.y);
				if (d < SNATCH_RADIUS && d < bestD) {
					best = f;
					bestD = d;
				}
			}
			if (best && Math.random() < FROG_ATTACK_RATE * dt) {
				frog.state = "anticipate";
				frog.stateT = 0;
				frog.target = best;
				frog.willMiss = Math.random() < MISS_PROB;
				frogBody.classList.add("crouch");
			}
			setTongue(0, 0, 0, 0, 0);
		} else if (frog.state === "anticipate") {
			frog.stateT += dt;
			if (frog.stateT >= ANTICIPATE_DUR) {
				frog.state = "shoot";
				frog.stateT = 0;
				frogBody.classList.remove("crouch");
				if (!frog.target || !frog.target.alive) {
					frog.state = "idle";
					return;
				}
				if (frog.willMiss) {
					frog.snatchX = frog.target.x - frog.target.vx * 0.2;
					frog.snatchY = frog.target.y - frog.target.vy * 0.2;
					const ex = frog.target.x - m.x,
						ey = frog.target.y - m.y;
					const el = Math.hypot(ex, ey) || 1;
					frog.target.vx += (ex / el) * 400;
					frog.target.vy += (ey / el) * 400;
					frog.target = null;
				} else {
					frog.target.beingEaten = true;
				}
			}
		} else if (frog.state === "shoot") {
			frog.stateT += dt;
			const t = Math.min(1, frog.stateT / SHOOT_DUR);
			if (frog.target && frog.target.alive) {
				const tx = m.x + (frog.target.x - m.x) * t;
				const ty = m.y + (frog.target.y - m.y) * t;
				setTongue(m.x, m.y, tx, ty, 1);
				if (t >= 1) {
					frog.state = "retract";
					frog.stateT = 0;
					frog.snatchX = frog.target.x;
					frog.snatchY = frog.target.y;
				}
			} else {
				const tx = m.x + (frog.snatchX - m.x) * t;
				const ty = m.y + (frog.snatchY - m.y) * t;
				setTongue(m.x, m.y, tx, ty, 1);
				if (t >= 1) {
					frog.state = "miss";
					frog.stateT = 0;
					sfx.miss();
					if (Math.random() < 0.4)
						frogSays(
							["Mist!", "Verdammt!", "Ups…", "Knapp!"][
								Math.floor(Math.random() * 4)
							],
							700,
						);
				}
			}
		} else if (frog.state === "miss") {
			frog.stateT += dt;
			const t = Math.min(1, frog.stateT / MISS_RETRACT);
			const tx = frog.snatchX + (m.x - frog.snatchX) * t;
			const ty = frog.snatchY + (m.y - frog.snatchY) * t;
			setTongue(m.x, m.y, tx, ty, 1 - t);
			if (t >= 1) {
				setTongue(0, 0, 0, 0, 0);
				frog.state = "idle";
				frog.stateT = 0;
			}
		} else if (frog.state === "retract") {
			frog.stateT += dt;
			const t = Math.min(1, frog.stateT / RETRACT_DUR);
			const tx = frog.snatchX + (m.x - frog.snatchX) * t;
			const ty = frog.snatchY + (m.y - frog.snatchY) * t;
			if (frog.target && frog.target.alive) {
				frog.target.x = tx;
				frog.target.y = ty;
				frog.target.vx = frog.target.vy = 0;
				frog.target.opacity = 1 - t;
				frog.target.scale = 1 - t * 0.6;
			}
			setTongue(m.x, m.y, tx, ty, 1 - t * 0.3);
			if (t >= 1) {
				setTongue(0, 0, 0, 0, 0);
				if (frog.target && frog.target.alive)
					killFly(frog.target, m.x, m.y, false);
				frog.target = null;
				triggerGulp();
				frog.state = "cooldown";
				frog.stateT = 0;
			}
		} else if (frog.state === "cooldown") {
			frog.stateT += dt;
			if (frog.stateT >= COOLDOWN) {
				frog.state = "idle";
				frog.stateT = 0;
			}
		}
	}

	// ---- Spawning (difficulty ramps with elapsed time) ----
	let spawnTimer = 0;
	let elapsed = 0;
	let startedAt = 0; // time when the secret game was unlocked
	// 🤫 The secret only reveals itself after this many seconds of innocent-looking page.
	// Once the player has discovered it once (everStarted), we don't make them wait again.
	const DISCOVERY_DELAY = 30;
	function updateSpawn(dt) {
		elapsed += dt;
		if (game.timeUp) return; // no new flies after the buzzer
		spawnTimer -= dt;
		// Before the secret is discovered for the very first time: stay completely empty
		// until DISCOVERY_DELAY has passed, then drop a single lonely fly as a clue.
		// After unlock, ramp up difficulty over time.
		let maxFlies;
		if (!game.started) {
			maxFlies = game.everStarted || elapsed >= DISCOVERY_DELAY ? 1 : 0;
		} else {
			maxFlies = game.frenzy
				? 14
				: Math.min(6, 2 + Math.floor((elapsed - startedAt) / 20));
		}
		const aliveCount = game.flies.filter(
			(f) => f.alive && !f.beingEaten,
		).length;
		if (aliveCount < maxFlies && spawnTimer <= 0) {
			let type = "normal";
			const r = Math.random();
			if (game.frenzy) {
				if (r < 0.55) type = "golden";
				else if (r < 0.7) type = "angry";
			} else if (game.started) {
				const sinceStart = elapsed - startedAt;
				if (r < 0.07) type = "golden";
				else if (sinceStart > 12 && r < 0.22) type = "angry";
			}
			game.flies.push(new Fly(type));
			spawnTimer = game.frenzy ? 0.25 : 0.9 + Math.random() * 1.8;
		}
	}

	// ---- Frenzy mode ----
	function triggerFrenzy() {
		if (game.frenzy) return;
		game.frenzy = true;
		game.frenzyTimer = 8;
		document.body.classList.add("frenzy");
		frogSays("FRENZY MODE! 🌈", 1500);
		sfx.frenzy();
		shake();
	}
	function updateFrenzy(dt) {
		if (!game.frenzy) return;
		game.frenzyTimer -= dt;
		if (game.frenzyTimer <= 0) {
			game.frenzy = false;
			document.body.classList.remove("frenzy");
			frogSays("Phew… 😮‍💨", 1000);
		}
	}

	// ---- Easter egg: type "frog" to trigger frenzy ----
	let keyBuf = "";
	window.addEventListener("keydown", (e) => {
		const el = document.activeElement;
		if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
		keyBuf = (keyBuf + e.key.toLowerCase()).slice(-8);
		if (keyBuf.endsWith("frog")) {
			if (!game.started) startGame();
			triggerFrenzy();
		}
	});

	// ---- Pupils track nearest fly ----
	function updatePupils() {
		if (!pupilL || !pupilR) return;
		const m = mouthPos();
		let tx = m.x,
			ty = m.y,
			found = false,
			bestD = Infinity;
		for (const f of game.flies) {
			if (!f.alive) continue;
			const d = Math.hypot(f.x - m.x, f.y - m.y);
			if (d < bestD) {
				bestD = d;
				tx = f.x;
				ty = f.y;
				found = true;
			}
		}
		const sceneRect = frogScene.getBoundingClientRect();
		const scl = sceneRect.width / 300;
		function track(pupil, cx, cy) {
			const eyeCenterX = sceneRect.left + cx * scl;
			const eyeCenterY = sceneRect.top + cy * scl;
			let dx = (tx - eyeCenterX) / scl;
			let dy = (ty - eyeCenterY) / scl;
			const len = Math.hypot(dx, dy) || 1;
			const max = 5;
			dx = Math.max(-max, Math.min(max, (dx / len) * max));
			dy = Math.max(-max, Math.min(max, (dy / len) * max));
			pupil.setAttribute("cx", cx + (found ? dx : 0));
			pupil.setAttribute("cy", cy + (found ? dy : 0));
		}
		track(pupilL, 122, 52);
		track(pupilR, 178, 52);
	}

	// ---- Cursor swap ----
	function updateCursor() {
		if (!mouseActive) {
			if (handActive) {
				handActive = false;
				document.body.classList.remove("fly-nearby");
			}
			return;
		}
		let nearest = Infinity;
		for (const f of game.flies) {
			if (!f.alive || f.beingEaten || f.opacity < 0.3) continue;
			const d = Math.hypot(f.x - mouseX, f.y - mouseY);
			if (d < nearest) nearest = d;
		}
		if (!handActive && nearest < HAND_ON_RADIUS) {
			handActive = true;
			document.body.classList.add("fly-nearby");
		} else if (handActive && nearest > HAND_OFF_RADIUS) {
			handActive = false;
			document.body.classList.remove("fly-nearby");
		}
	}

	// ---- Belly: persistent fullness + pulse on gulp (driven from JS to avoid CSS/JS scale conflicts) ----
	let gulpStart = -1e9;
	const GULP_DUR = 500;
	function triggerGulp() {
		gulpStart = performance.now();
	}
	function updateBelly() {
		const t = (performance.now() - gulpStart) / GULP_DUR;
		let pulse = 1;
		if (t >= 0 && t < 1) {
			// 0..0.35 grow to 1.15, then 0.35..1 shrink back to 1
			pulse =
				t < 0.35 ? 1 + 0.15 * (t / 0.35) : 1.15 - 0.15 * ((t - 0.35) / 0.65);
		}
		belly.style.transform = `scale(${game.bellyBoost * pulse})`;
	}

	// ---- Main loop ----
	let last = performance.now(),
		paused = false;
	document.addEventListener("visibilitychange", () => {
		paused = document.hidden;
		if (!paused) last = performance.now();
	});

	function frame(now) {
		if (paused) {
			requestAnimationFrame(frame);
			return;
		}
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;

		if (game.comboTimer > 0) {
			game.comboTimer -= dt;
			if (game.comboTimer <= 0 && game.combo > 1) resetCombo();
		}

		// ⏱️ Match timer counts down once the secret game is started
		if (game.started && !game.timeUp) {
			game.timeLeft -= dt;
			if (game.timeLeft <= 0) {
				game.timeLeft = 0;
				endGame();
			}
		}

		updateSpawn(dt);
		updateFrenzy(dt);

		for (const f of game.flies) f.update(dt);
		for (let i = game.particles.length - 1; i >= 0; i--) {
			const p = game.particles[i];
			p.update(dt);
			if (p.life <= 0) {
				p.destroy();
				game.particles.splice(i, 1);
			} else p.render();
		}
		game.flies = game.flies.filter((f) => f.alive);

		updateFrog(dt);

		for (const f of game.flies) f.render();

		updatePupils();
		updateCursor();
		updateBelly();
		updateHUD();

		requestAnimationFrame(frame);
	}

	// 🤫 No initial fly — the page must look completely innocent at first.
	// updateSpawn() waits at least DISCOVERY_DELAY before placing the first fly,
	// so casual visitors never see anything unusual.
	updateHUD();
	requestAnimationFrame(frame);

	window.addEventListener("resize", () => {
		for (const f of game.flies) {
			f.x = Math.min(f.x, window.innerWidth - 10);
			f.y = Math.min(f.y, window.innerHeight - 10);
			f.pickTarget();
		}
	});
})();
