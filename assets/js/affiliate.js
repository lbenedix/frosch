const AFFILIATE_TAG = "rwgb-21";
const AFFILIATE_LOG_PREFIX = "[affiliate]";
const AFFILIATE_DEBUG =
	new URL(location.href).searchParams.get("debug") === "1" ||
	localStorage.getItem("frogDebug") === "1";

function logAffiliateDebug(message, extra) {
	if (!AFFILIATE_DEBUG) return;
	if (extra !== undefined) console.debug(AFFILIATE_LOG_PREFIX, message, extra);
	else console.debug(AFFILIATE_LOG_PREFIX, message);
}

function logAffiliateInfo(message, extra) {
	if (extra !== undefined) console.info(AFFILIATE_LOG_PREFIX, message, extra);
	else console.info(AFFILIATE_LOG_PREFIX, message);
}

function logAffiliateWarn(message, extra) {
	if (extra !== undefined) console.warn(AFFILIATE_LOG_PREFIX, message, extra);
	else console.warn(AFFILIATE_LOG_PREFIX, message);
}

function extractASIN(path) {
	const dp = path.match(/\/dp\/([A-Z0-9]{10})/);
	if (dp) return dp[1];

	const gp = path.match(/\/gp\/product\/([A-Z0-9]{10})/);
	if (gp) return gp[1];

	return null;
}

function showToast(text) {
	const toast = document.getElementById("toast");
	if (!toast) return;
	toast.textContent = text;
	toast.classList.add("show");
	setTimeout(() => toast.classList.remove("show"), 1800);
}

async function generateLink() {
	const inputEl = document.getElementById("inputLink");
	const outputEl = document.getElementById("output");
	const input = inputEl ? inputEl.value.trim() : "";

	if (!input) {
		logAffiliateWarn("Leerer Input beim Link-Generator.");
		alert("Bitte Link eingeben 🐸");
		return;
	}

	logAffiliateDebug("Starte Affiliate-Link-Generierung.", {
		inputLength: input.length,
	});

	try {
		const url = new URL(input);
		const asin = extractASIN(url.pathname);

		if (!asin) {
			logAffiliateWarn("Keine ASIN im Pfad gefunden.", { path: url.pathname });
			if (outputEl) outputEl.innerHTML = "❌ Keine ASIN gefunden";
			return;
		}

		const clean = `${url.origin}/dp/${asin}/?tag=${AFFILIATE_TAG}`;

		await navigator.clipboard.writeText(clean);
		logAffiliateInfo(
			"Affiliate-Link generiert und in Zwischenablage kopiert.",
			{ asin },
		);
		showToast("Kopiert 🐸✨");

		if (outputEl) {
			outputEl.innerHTML = `
        <div class="result">
          <a href="${clean}" target="_blank">${clean}</a>
        </div>
      `;
		}
	} catch (error) {
		logAffiliateWarn("Link-Generierung fehlgeschlagen.", error);
		alert("Ungültiger Link ❌");
	}
}

function toggleTheme() {
	const hadFrenzy = document.body.classList.contains("frenzy");
	document.body.classList.toggle("light");
	// Safari/WebKit can lose running filter animations after class changes.
	if (hadFrenzy) {
		document.body.classList.remove("frenzy");
		void document.body.offsetWidth;
		document.body.classList.add("frenzy");
	}
	logAffiliateDebug("Theme umgeschaltet.", {
		isLight: document.body.classList.contains("light"),
		frenzyActive: document.body.classList.contains("frenzy"),
	});
}

(function initAffiliate() {
	const generateBtn = document.getElementById("generateBtn");
	const themeToggle = document.getElementById("themeToggle");
	const inputEl = document.getElementById("inputLink");

	if (generateBtn) {
		generateBtn.addEventListener("click", generateLink);
	} else {
		logAffiliateWarn("Button #generateBtn wurde nicht gefunden.");
	}

	if (themeToggle) {
		themeToggle.addEventListener("click", toggleTheme);
	} else {
		logAffiliateWarn("Button #themeToggle wurde nicht gefunden.");
	}

	if (inputEl) {
		inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter") generateLink();
		});
	} else {
		logAffiliateWarn("Input #inputLink wurde nicht gefunden.");
	}

	logAffiliateInfo("Affiliate/UI-Events initialisiert.");
})();
