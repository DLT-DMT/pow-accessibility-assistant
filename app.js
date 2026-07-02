const dutyFields = [
  ["incoming", "Incoming"],
  ["act1", "Act 1"],
  ["interval", "Interval"],
  ["act2", "Act 2"],
  ["outgoing", "Outgoing"],
  ["matinees", "Matinees"],
  ["standby", "Standby / Evac"],
  ["clearance", "Clearance"],
];

const DEFAULT_PROFILE = "standard";
const PROFILE_STORAGE_KEY = "pow-access-profile-v1";

let deferredInstallPrompt = null;
let waitingServiceWorker = null;
let updateReloadStarted = false;

const state = {
  data: null,
  profile: localStorage.getItem(PROFILE_STORAGE_KEY) || DEFAULT_PROFILE,
  statusFilter: "All",
  query: "",
  selectedId: "",
  installGuideForced: false,
};

const elements = {
  androidInstallButton: document.querySelector("#androidInstallButton"),
  installHelpButton: document.querySelector("#installHelpButton"),
  installPanel: document.querySelector("#installPanel"),
  installSteps: document.querySelector("#installSteps"),
  profileControls: document.querySelector("#profileControls"),
  summaryStrip: document.querySelector("#summaryStrip"),
  statusFilters: document.querySelector("#statusFilters"),
  searchInput: document.querySelector("#searchInput"),
  trackList: document.querySelector("#trackList"),
  trackDetail: document.querySelector("#trackDetail"),
  updateButton: document.querySelector("#updateButton"),
  updatePanel: document.querySelector("#updatePanel"),
  versionLabel: document.querySelector("#versionLabel"),
};

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallGuide();
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  state.installGuideForced = false;
  updateInstallGuide();
});

init();

async function init() {
  renderLoading();

  try {
    state.data = await loadTrackData();
    if (!state.data.profiles.some((profile) => profile.id === state.profile)) {
      state.profile = state.data.profiles[0].id;
    }
    state.selectedId = state.data.tracks[0]?.id || "";

    elements.searchInput.addEventListener("input", (event) => {
      state.query = event.target.value;
      render();
    });

    elements.androidInstallButton.addEventListener("click", installAndroidApp);
    elements.installHelpButton.addEventListener("click", () => {
      state.installGuideForced = true;
      updateInstallGuide();
      elements.installPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    elements.updateButton.addEventListener("click", applyAvailableUpdate);

    render();
    updateVersionLabel();
    updateInstallGuide();
    registerServiceWorker();
  } catch (error) {
    console.error(error);
    renderError();
  }
}

async function loadTrackData() {
  if (window.POW_ACCESSIBILITY_DATA) {
    return window.POW_ACCESSIBILITY_DATA;
  }

  const response = await fetch("./data/tracks.json", { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Data request failed: ${response.status}`);
  }

  return response.json();
}

function updateVersionLabel() {
  const version = globalThis.POW_APP_VERSION || state.data?.meta?.version || "1.0.0";
  elements.versionLabel.textContent = `Version ${version}`;
}

function renderLoading() {
  elements.trackList.innerHTML =
    '<div class="empty-state"><p>Loading tracks</p></div>';
  elements.trackDetail.innerHTML =
    '<div class="empty-state"><p>Loading details</p></div>';
}

function renderError() {
  elements.trackList.innerHTML =
    '<div class="empty-state"><p>Track data could not be loaded</p></div>';
  elements.trackDetail.innerHTML =
    '<div class="empty-state"><p>Open from an installed or hosted copy of the app.</p></div>';
}

function render() {
  renderProfileControls();
  renderSummary();
  renderStatusFilters();

  const tracks = getFilteredTracks();
  if (!tracks.some((track) => track.id === state.selectedId)) {
    state.selectedId = tracks[0]?.id || "";
  }

  renderTrackList(tracks);
  renderTrackDetail(tracks);
  updateInstallGuide();
}

function renderProfileControls() {
  elements.profileControls.replaceChildren(
    ...state.data.profiles.map((profile) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        profile.id === state.profile
          ? "switch-button active"
          : "switch-button";
      button.setAttribute("aria-pressed", String(profile.id === state.profile));
      button.textContent = profile.label;
      button.addEventListener("click", () => {
        state.profile = profile.id;
        state.statusFilter = "All";
        localStorage.setItem(PROFILE_STORAGE_KEY, state.profile);
        render();
      });
      return button;
    }),
  );
}

function renderSummary() {
  if (state.profile === "standard") {
    elements.summaryStrip.replaceChildren(
      createStat("standard", "Tracks", state.data.tracks.length),
      createStat("standard", "Duties", dutyFields.length),
      createStat("standard", "Adjustments", 0),
    );
    return;
  }

  const counts = {
    Suitable: 0,
    Adjustments: 0,
    "Not suitable": 0,
    "Check notes": 0,
  };

  state.data.tracks.forEach((track) => {
    counts[classifyStatus(getStatus(track))] += 1;
  });

  elements.summaryStrip.replaceChildren(
    createStat("suitable", "Suitable", counts.Suitable),
    createStat("adjustments", "Adjustments", counts.Adjustments),
    createStat("not-suitable", "Not suitable", counts["Not suitable"]),
  );
}

function createStat(kind, label, value) {
  const card = document.createElement("div");
  card.className = `status-stat is-${kind}`;

  const title = document.createElement("span");
  title.textContent = label;

  const total = document.createElement("strong");
  total.textContent = value;

  card.append(title, total);
  return card;
}

function renderStatusFilters() {
  const filters =
    state.profile === "standard"
      ? ["All"]
      : ["All", "Suitable", "Adjustments", "Not suitable"];

  if (!filters.includes(state.statusFilter)) {
    state.statusFilter = "All";
  }

  elements.statusFilters.replaceChildren(
    ...filters.map((filter) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        state.statusFilter === filter
          ? "filter-button active"
          : "filter-button";
      button.setAttribute(
        "aria-pressed",
        String(state.statusFilter === filter),
      );
      button.textContent = filter === "Adjustments" ? "With adjustments" : filter;
      button.addEventListener("click", () => {
        state.statusFilter = filter;
        render();
      });
      return button;
    }),
  );
}

function getFilteredTracks() {
  const query = state.query.trim().toLowerCase();

  return state.data.tracks.filter((track) => {
    const kind = classifyStatus(getStatus(track));
    const filterMatch =
      state.statusFilter === "All" || state.statusFilter === kind;
    const searchMatch =
      query.length === 0 || getSearchableText(track).includes(query);

    return filterMatch && searchMatch;
  });
}

function renderTrackList(tracks) {
  if (tracks.length === 0) {
    elements.trackList.innerHTML =
      '<div class="empty-state"><p>No matching tracks</p></div>';
    return;
  }

  elements.trackList.replaceChildren(
    ...tracks.map((track) => {
      const kind = classifyStatus(getStatus(track));
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        state.selectedId === track.id ? "track-card selected" : "track-card";

      const name = document.createElement("span");
      name.className = "track-name";
      name.textContent = track.position;

      const pill = document.createElement("span");
      pill.className = `status-pill ${getStatusClass(kind)}`;
      pill.textContent = getStatusLabel(kind);

      const raw = document.createElement("span");
      raw.className = "raw-status";
      raw.textContent = getStatus(track);

      button.append(name, pill, raw);
      button.addEventListener("click", () => {
        state.selectedId = track.id;
        render();
      });
      return button;
    }),
  );
}

function renderTrackDetail(filteredTracks) {
  const track =
    state.data.tracks.find((item) => item.id === state.selectedId) ||
    filteredTracks[0];

  if (!track) {
    elements.trackDetail.innerHTML =
      '<div class="empty-state"><p>No track selected</p></div>';
    return;
  }

  const kind = classifyStatus(getStatus(track));
  const profile = state.data.profiles.find((item) => item.id === state.profile);
  const fragment = document.createDocumentFragment();

  const heading = document.createElement("div");
  heading.className = "detail-heading";
  const profileName = document.createElement("p");
  profileName.textContent = profile?.label || "";
  const title = document.createElement("h2");
  title.textContent = track.position;
  const pill = document.createElement("span");
  pill.className = `status-pill ${getStatusClass(kind)}`;
  pill.textContent = getStatusLabel(kind);
  heading.append(profileName, title, pill);
  fragment.append(heading);

  fragment.append(
    createSection("Overall Status", getStatus(track), "important"),
  );

  const adjustment = getAdjustment(track);
  if (state.profile !== "standard" && adjustment) {
    fragment.append(
      createSection("Required Adjustments / Rationale", adjustment, "important"),
    );
  }

  const stack = document.createElement("div");
  stack.className = "duty-stack";
  dutyFields.forEach(([key, label]) => {
    const value = getDuty(track, key);
    if (!value) {
      return;
    }

    const detail = document.createElement("details");
    detail.className = "duty-detail";
    const summary = document.createElement("summary");
    summary.textContent = label;
    const body = document.createElement("p");
    body.textContent = value;
    detail.append(summary, body);
    stack.append(detail);
  });
  fragment.append(stack);

  elements.trackDetail.replaceChildren(fragment);
}

function createSection(titleText, bodyText, modifier = "") {
  const section = document.createElement("div");
  section.className = modifier ? `detail-section ${modifier}` : "detail-section";

  const title = document.createElement("h3");
  title.textContent = titleText;

  const body = document.createElement("p");
  body.textContent = bodyText;

  section.append(title, body);
  return section;
}

function getStatus(track) {
  return track.statuses[state.profile] || "Check notes";
}

function getAdjustment(track) {
  return track.adjustments[state.profile] || "";
}

function getDuty(track, key) {
  return track.duties[state.profile]?.[key] || "";
}

function getSearchableText(track) {
  return [
    track.position,
    getStatus(track),
    getAdjustment(track),
    ...dutyFields.map(([key]) => getDuty(track, key)),
  ]
    .join(" ")
    .toLowerCase();
}

function classifyStatus(status) {
  if (state.profile === "standard") {
    return "Standard";
  }

  const text = status.toLowerCase();

  if (text.includes("not suitable")) {
    return "Not suitable";
  }

  if (
    text.includes("adjust") ||
    text.includes("partial") ||
    text.includes("provisional") ||
    text.includes("pending")
  ) {
    return "Adjustments";
  }

  if (text.includes("accessible") || text.includes("suitable")) {
    return "Suitable";
  }

  return "Check notes";
}

function getStatusLabel(kind) {
  if (kind === "Adjustments") {
    return "Suitable with adjustments";
  }
  if (kind === "Standard") {
    return "Standard duties";
  }
  return kind;
}

function getStatusClass(kind) {
  switch (kind) {
    case "Suitable":
      return "is-suitable";
    case "Adjustments":
      return "is-adjustments";
    case "Not suitable":
      return "is-not-suitable";
    case "Standard":
      return "is-standard";
    default:
      return "is-check";
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") {
    return;
  }

  navigator.serviceWorker
    .register("./service-worker.js", { updateViaCache: "none" })
    .then((registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdateAvailable(registration.waiting);
      }

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) {
          return;
        }

        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            showUpdateAvailable(newWorker);
          }
        });
      });

      if (navigator.onLine) {
        registration.update().catch(() => {});
      }
    })
    .catch((error) => {
      console.warn("Service worker registration failed", error);
    });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (updateReloadStarted) {
      return;
    }
    updateReloadStarted = true;
    window.location.reload();
  });
}

function showUpdateAvailable(worker) {
  waitingServiceWorker = worker;
  elements.updatePanel.hidden = false;
}

function applyAvailableUpdate() {
  if (!waitingServiceWorker) {
    return;
  }

  waitingServiceWorker.postMessage({ type: "SKIP_WAITING" });
}

async function installAndroidApp() {
  if (!deferredInstallPrompt) {
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice.catch(() => {});
  deferredInstallPrompt = null;
  updateInstallGuide();
}

function updateInstallGuide() {
  const installed = isInstalled();
  const showGuide = state.installGuideForced || !installed;

  elements.installPanel.hidden = !showGuide;
  elements.installHelpButton.hidden = !installed;
  elements.androidInstallButton.hidden = !deferredInstallPrompt || installed;

  if (!showGuide) {
    return;
  }

  const platform = getPlatform();
  elements.installSteps.replaceChildren(...getInstallSteps(platform).map(createStep));
}

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function getPlatform() {
  const ua = navigator.userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(ua)) {
    return "ios";
  }

  if (/android/.test(ua)) {
    return "android";
  }

  return "desktop";
}

function getInstallSteps(platform) {
  if (platform === "ios") {
    return ["Open in Safari", "Tap Share", "Tap Add to Home Screen"];
  }

  if (platform === "android") {
    return deferredInstallPrompt
      ? ["Tap Install App", "Confirm installation", "Open from your Home Screen"]
      : ["Open browser menu", "Tap Install App or Add to Home Screen", "Confirm installation"];
  }

  return ["Open the browser install menu", "Choose Install App", "Open from your apps"];
}

function createStep(text, index) {
  const item = document.createElement("div");
  item.className = "install-step";

  const number = document.createElement("span");
  number.textContent = String(index + 1);

  const label = document.createElement("p");
  label.textContent = text;

  item.append(number, label);
  return item;
}
