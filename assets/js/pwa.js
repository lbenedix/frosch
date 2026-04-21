/* =====================================================
   📲 PWA — static manifest + install prompt button
   ===================================================== */
const PWA_LOG_PREFIX = "[pwa]";
const PWA_DEBUG =
	new URL(location.href).searchParams.get("debug") === "1" ||
	localStorage.getItem("frogDebug") === "1";

function logPwaDebug(message, extra) {
	if (!PWA_DEBUG) return;
	if (extra !== undefined) console.debug(PWA_LOG_PREFIX, message, extra);
	else console.debug(PWA_LOG_PREFIX, message);
}

function logPwaInfo(message, extra) {
	if (extra !== undefined) console.info(PWA_LOG_PREFIX, message, extra);
	else console.info(PWA_LOG_PREFIX, message);
}

function logPwaWarn(message, extra) {
	if (extra !== undefined) console.warn(PWA_LOG_PREFIX, message, extra);
	else console.warn(PWA_LOG_PREFIX, message);
}

(function initPwa() {
	const manifestLink = document.querySelector('link[rel="manifest"]');
	if (!manifestLink)
		logPwaWarn("Kein statischer Manifest-Link im <head> gefunden.");
	else
		logPwaDebug("Statisches Manifest erkannt.", {
			href: manifestLink.getAttribute("href"),
		});

	let deferredPrompt = null;
	const installBtn = document.getElementById("installBtn");
	if (!installBtn) {
		logPwaWarn("Install-Button #installBtn wurde nicht gefunden.");
		return;
	}

	window.addEventListener("beforeinstallprompt", (e) => {
		e.preventDefault();
		deferredPrompt = e;
		installBtn.classList.add("show");
		logPwaInfo("beforeinstallprompt abgefangen, Install-CTA sichtbar.");
	});

	installBtn.addEventListener("click", async () => {
		if (!deferredPrompt) {
			logPwaDebug("Install-Klick ohne verfuegbaren Prompt ignoriert.");
			return;
		}

		logPwaInfo("Install-Prompt wird angezeigt.");
		deferredPrompt.prompt();
		try {
			const choice = await deferredPrompt.userChoice;
			logPwaInfo("Install-Prompt beendet.", choice);
		} catch (_) {}
		deferredPrompt = null;
		installBtn.classList.remove("show");
	});

	window.addEventListener("appinstalled", () => {
		installBtn.classList.remove("show");
		logPwaInfo("App wurde installiert.");
	});

	logPwaInfo("PWA-Handler initialisiert.");
})();
