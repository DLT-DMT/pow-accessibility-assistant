const DEFAULT_PROFILE = "standard";

let deferredInstallPrompt = null;
let waitingServiceWorker = null;
let updateReloadStarted = false;

const state = {
  data: null,
  step: 1,
  theatreId: "",
  trackId: "",
  profileId: DEFAULT_PROFILE,
  supporting: false,
  supportTrackId: "",
  supportProfileId: DEFAULT_PROFILE,
  installGuideForced: false,
};

const elements = {
  androidInstallButton: document.querySelector("#androidInstallButton"),
  installHelpButton: document.querySelector("#installHelpButton"),
  installPanel: document.querySelector("#installPanel"),
  installSteps: document.querySelector("#installSteps"),
  stepTabs: document.querySelector("#stepTabs"),
  updateButton: document.querySelector("#updateButton"),
  updatePanel: document.querySelector("#updatePanel"),
  versionLabel: document.querySelector("#versionLabel"),
  workflow: document.querySelector("#workflow"),
};

const stepLabels = ["Theatre", "About Me", "Support", "My Shift"];

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
  try {
    state.data = await loadMasterData();
    state.data.phases.sort((a, b) => a.sortOrder - b.sortOrder);
    state.data.profiles.sort((a, b) => a.sortOrder - b.sortOrder);
    state.data.tracks.sort((a, b) => a.number - b.number);
    state.data.baselineTasks.sort((a, b) => a.sequence - b.sequence);

    state.theatreId = state.data.theatres[0]?.id || "";
    state.trackId = getTracksForTheatre()[0]?.id || "";
    state.supportTrackId = state.trackId;

    elements.androidInstallButton.addEventListener("click", installAndroidApp);
    elements.installHelpButton.addEventListener("click", () => {
      state.installGuideForced = true;
      updateInstallGuide();
      elements.installPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    elements.updateButton.addEventListener("click", applyAvailableUpdate);

    updateVersionLabel();
    render();
    updateInstallGuide();
    registerServiceWorker();
  } catch (error) {
    console.error(error);
    renderError();
  }
}

async function loadMasterData() {
  if (window.POW_MASTER_DATA) {
    return window.POW_MASTER_DATA;
  }

  const response = await fetch("./data/master-data.json", { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Data request failed: ${response.status}`);
  }

  return response.json();
}

function updateVersionLabel() {
  const version = globalThis.POW_APP_VERSION || state.data?.meta?.version || "2.0.0";
  elements.versionLabel.textContent = `Version ${version}`;
}

function renderError() {
  elements.workflow.innerHTML = "";
  elements.workflow.append(createEmptyState("Shift data could not be loaded"));
}

function render() {
  renderStepTabs();
  elements.workflow.innerHTML = "";

  if (state.step === 1) {
    elements.workflow.append(renderTheatreScreen());
  } else if (state.step === 2) {
    elements.workflow.append(renderAboutScreen());
  } else if (state.step === 3) {
    elements.workflow.append(renderSupportScreen());
  } else {
    elements.workflow.append(renderShiftScreen());
  }

  updateInstallGuide();
}

function renderStepTabs() {
  elements.stepTabs.replaceChildren(
    ...stepLabels.map((label, index) => {
      const stepNumber = index + 1;
      const button = document.createElement("button");
      button.type = "button";
      button.className = stepNumber === state.step ? "step-tab active" : "step-tab";
      button.textContent = label;
      button.disabled = stepNumber > state.step;
      button.addEventListener("click", () => {
        state.step = stepNumber;
        render();
      });
      return button;
    }),
  );
}

function renderTheatreScreen() {
  const panel = createPanel("Theatre", "Select theatre");
  const theatreList = document.createElement("div");
  theatreList.className = "option-stack";

  state.data.theatres.forEach((theatre) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = theatre.id === state.theatreId ? "choice-card active" : "choice-card";
    button.setAttribute("aria-pressed", String(theatre.id === state.theatreId));
    button.addEventListener("click", () => {
      state.theatreId = theatre.id;
      const tracks = getTracksForTheatre();
      if (!tracks.some((track) => track.id === state.trackId)) {
        state.trackId = tracks[0]?.id || "";
      }
      if (!tracks.some((track) => track.id === state.supportTrackId)) {
        state.supportTrackId = state.trackId;
      }
      render();
    });

    const title = document.createElement("strong");
    title.textContent = theatre.name;
    const meta = document.createElement("span");
    meta.textContent = theatre.organisation;
    button.append(title, meta);
    theatreList.append(button);
  });

  panel.append(theatreList, createActionRow([
    createButton("Continue", "primary-action", () => goToStep(2)),
  ]));
  return panel;
}

function renderAboutScreen() {
  const panel = createPanel("About Me", "My allocation");
  panel.append(
    createSelectField(
      "Select My Track",
      state.trackId,
      getTracksForTheatre().map((track) => ({ value: track.id, label: track.name })),
      (value) => {
        state.trackId = value;
        if (!state.supportTrackId) {
          state.supportTrackId = value;
        }
      },
    ),
    createProfileControl("Select My Mobility", state.profileId, (profileId) => {
      state.profileId = profileId;
    }),
    createActionRow([
      createButton("Back", "secondary-action", () => goToStep(1)),
      createButton("Continue", "primary-action", () => goToStep(3)),
    ]),
  );
  return panel;
}

function renderSupportScreen() {
  const panel = createPanel("Supporting Another Colleague?", "Support");
  const toggle = document.createElement("div");
  toggle.className = "segmented-control";
  toggle.append(
    createSegmentButton("No", !state.supporting, () => {
      state.supporting = false;
      render();
    }),
    createSegmentButton("Yes", state.supporting, () => {
      state.supporting = true;
      if (!state.supportTrackId) {
        state.supportTrackId = state.trackId;
      }
      render();
    }),
  );
  panel.append(toggle);

  if (state.supporting) {
    panel.append(
      createSelectField(
        "Supporting Track",
        state.supportTrackId,
        getTracksForTheatre().map((track) => ({ value: track.id, label: track.name })),
        (value) => {
          state.supportTrackId = value;
        },
      ),
      createProfileControl("Supporting Mobility", state.supportProfileId, (profileId) => {
        state.supportProfileId = profileId;
      }),
    );
  }

  panel.append(createActionRow([
    createButton("Back", "secondary-action", () => goToStep(2)),
    createButton("Start Shift", "primary-action", () => goToStep(4)),
  ]));
  return panel;
}

function renderShiftScreen() {
  const track = getTrack(state.trackId);
  const profile = getProfile(state.profileId);
  const supportTrack = state.supporting ? getTrack(state.supportTrackId) : null;
  const supportProfile = state.supporting ? getProfile(state.supportProfileId) : null;
  const ownAccess = getTrackAccessibility(state.trackId, state.profileId);
  const supportTasks = getAllVisibleSupportTasks();

  const panel = document.createElement("section");
  panel.className = "dashboard";

  const header = document.createElement("div");
  header.className = "dashboard-header";

  const headingBlock = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "panel-label";
  eyebrow.textContent = "My Shift Tonight";
  const title = document.createElement("h2");
  title.textContent = track?.name || "Selected track";
  const subtitle = document.createElement("p");
  subtitle.className = "muted";
  subtitle.textContent = profile?.label || "No Accessibility Requirements";
  headingBlock.append(eyebrow, title, subtitle);

  header.append(headingBlock);
  panel.append(header);

  panel.append(renderShiftSummary(track, profile, supportTrack, supportProfile, supportTasks));

  if (ownAccess && state.profileId !== DEFAULT_PROFILE) {
    panel.append(renderTrackStatus(ownAccess));
  }

  const runningOrder = document.createElement("div");
  runningOrder.className = "running-order";
  state.data.phases.forEach((phase) => {
    const phaseCard = renderPhaseCard(phase);
    if (phaseCard) {
      runningOrder.append(phaseCard);
    }
  });

  if (!runningOrder.children.length) {
    runningOrder.append(createEmptyState("No tasks found for this selection"));
  }

  panel.append(runningOrder);
  panel.append(createActionRow([
    createButton("Change details", "secondary-action", () => goToStep(2)),
    createButton("Start again", "text-action", () => {
      state.step = 1;
      state.profileId = DEFAULT_PROFILE;
      state.supporting = false;
      state.supportProfileId = DEFAULT_PROFILE;
      render();
    }),
  ]));
  return panel;
}

function renderShiftSummary(track, profile, supportTrack, supportProfile, supportTasks) {
  const summary = document.createElement("section");
  summary.className = "summary-grid";
  summary.append(
    createSummaryTile("Track", track?.name || ""),
    createSummaryTile("Mobility", profile?.label || ""),
    createSummaryTile("Support tasks", String(supportTasks.length)),
  );
  if (supportTrack && supportProfile && state.supportProfileId !== DEFAULT_PROFILE) {
    summary.append(createSummaryTile("Supporting", `${supportTrack.name} - ${supportProfile.label}`));
  }
  return summary;
}

function renderTrackStatus(access) {
  const card = document.createElement("section");
  card.className = `track-status ${statusClass(access.statusId)}`;
  const label = document.createElement("p");
  label.className = "panel-label";
  label.textContent = "Overall status";
  const status = document.createElement("strong");
  status.textContent = access.status;
  const summary = document.createElement("p");
  summary.textContent = access.summary || access.requiredAdjustment;
  card.append(label, status, summary);
  return card;
}

function renderPhaseCard(phase) {
  const ownTasks = getOwnTasksForPhase(phase.id);
  const phaseAccess = getPhaseAccessibility(state.trackId, phase.id, state.profileId);
  const supportTasks = getSupportTasksForPhase(phase.id, ownTasks);

  if (!ownTasks.length && !phaseAccess?.assessment && !supportTasks.length) {
    return null;
  }

  const card = document.createElement("section");
  card.className = "phase-card";

  const header = document.createElement("div");
  header.className = "phase-header";
  const title = document.createElement("h3");
  title.textContent = phase.label;
  header.append(title);
  if (phaseAccess && state.profileId !== DEFAULT_PROFILE) {
    header.append(createStatusPill(phaseAccess.status, phaseAccess.statusId));
  }
  card.append(header);

  if (ownTasks.length) {
    const list = document.createElement("ol");
    list.className = "task-list";
    ownTasks.forEach((task) => {
      const item = document.createElement("li");
      item.textContent = task.text;
      list.append(item);
    });
    card.append(list);
  }

  if (phaseAccess && state.profileId !== DEFAULT_PROFILE && shouldShowAssessment(phaseAccess)) {
    const note = document.createElement("div");
    note.className = `adjustment-note ${statusClass(phaseAccess.statusId)}`;
    const label = document.createElement("span");
    label.textContent = phaseAccess.status;
    const text = document.createElement("p");
    text.textContent = phaseAccess.assessment;
    note.append(label, text);
    card.append(note);
  }

  if (supportTasks.length) {
    const supportBlock = document.createElement("div");
    supportBlock.className = "support-block";
    const label = document.createElement("span");
    label.textContent = "Supporting another colleague";
    supportBlock.append(label);
    supportTasks.forEach((task) => {
      const item = document.createElement("article");
      item.className = "support-task";
      const title = document.createElement("strong");
      title.textContent = task.title;
      const text = document.createElement("p");
      text.textContent = task.text;
      item.append(title, text);
      supportBlock.append(item);
    });
    card.append(supportBlock);
  }

  return card;
}

function createPanel(titleText, labelText) {
  const panel = document.createElement("section");
  panel.className = "setup-panel";
  const label = document.createElement("p");
  label.className = "panel-label";
  label.textContent = labelText;
  const title = document.createElement("h2");
  title.textContent = titleText;
  panel.append(label, title);
  return panel;
}

function createSelectField(labelText, value, options, onChange) {
  const label = document.createElement("label");
  label.className = "field";
  const span = document.createElement("span");
  span.textContent = labelText;
  const select = document.createElement("select");
  options.forEach((option) => {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    select.append(item);
  });
  select.value = value;
  select.addEventListener("change", (event) => {
    onChange(event.target.value);
  });
  label.append(span, select);
  return label;
}

function createProfileControl(labelText, selectedProfileId, onChange) {
  const wrapper = document.createElement("div");
  wrapper.className = "field";
  const label = document.createElement("span");
  label.textContent = labelText;
  const controls = document.createElement("div");
  controls.className = "profile-grid";
  state.data.profiles.forEach((profile) => {
    controls.append(createSegmentButton(profile.label, profile.id === selectedProfileId, () => {
      onChange(profile.id);
      render();
    }));
  });
  wrapper.append(label, controls);
  return wrapper;
}

function createSegmentButton(label, active, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = active ? "segment-button active" : "segment-button";
  button.setAttribute("aria-pressed", String(active));
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function createActionRow(buttons) {
  const row = document.createElement("div");
  row.className = "action-row";
  row.append(...buttons);
  return row;
}

function createButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function createSummaryTile(label, value) {
  const tile = document.createElement("div");
  tile.className = "summary-tile";
  const small = document.createElement("span");
  small.textContent = label;
  const strong = document.createElement("strong");
  strong.textContent = value;
  tile.append(small, strong);
  return tile;
}

function createStatusPill(label, statusId) {
  const pill = document.createElement("span");
  pill.className = `status-pill ${statusClass(statusId)}`;
  pill.textContent = label;
  return pill;
}

function createEmptyState(message) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  const text = document.createElement("p");
  text.textContent = message;
  empty.append(text);
  return empty;
}

function goToStep(step) {
  state.step = step;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getTracksForTheatre() {
  return state.data.tracks.filter((track) => track.theatreId === state.theatreId);
}

function getTrack(trackId) {
  return state.data.tracks.find((track) => track.id === trackId);
}

function getProfile(profileId) {
  return state.data.profiles.find((profile) => profile.id === profileId);
}

function getTrackAccessibility(trackId, profileId) {
  return state.data.trackAccessibility.find(
    (item) => item.trackId === trackId && item.profileId === profileId,
  );
}

function getPhaseAccessibility(trackId, phaseId, profileId) {
  if (profileId === DEFAULT_PROFILE) {
    return null;
  }
  return state.data.phaseAccessibility.find(
    (item) =>
      item.trackId === trackId &&
      item.phaseId === phaseId &&
      item.profileId === profileId,
  );
}

function getOwnTasksForPhase(phaseId) {
  return state.data.baselineTasks.filter(
    (task) => task.trackId === state.trackId && task.phaseId === phaseId,
  );
}

function getSupportTasksForPhase(phaseId, ownTasks = []) {
  if (!state.supporting || state.supportProfileId === DEFAULT_PROFILE) {
    return [];
  }

  const ownTaskKeys = new Set(ownTasks.map((task) => normalizeTaskText(task.text)));
  return state.data.supportTasks.filter((task) => {
    if (task.requestingTrackId !== state.supportTrackId) return false;
    if (task.requestingProfileId !== state.supportProfileId) return false;
    if (task.phaseId !== phaseId) return false;
    if (!task.eligibleSupportProfileIds.includes(state.profileId)) return false;
    return !ownTaskKeys.has(normalizeTaskText(task.text));
  });
}

function getAllVisibleSupportTasks() {
  return state.data.phases.flatMap((phase) =>
    getSupportTasksForPhase(phase.id, getOwnTasksForPhase(phase.id)),
  );
}

function shouldShowAssessment(phaseAccess) {
  if (!phaseAccess.assessment) {
    return false;
  }
  return phaseAccess.statusId !== "suitable" || phaseAccess.supportRequired;
}

function normalizeTaskText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function statusClass(statusId) {
  if (statusId === "suitable") return "is-suitable";
  if (statusId === "suitable_adjustments") return "is-adjustment";
  if (statusId === "partially_accessible") return "is-partial";
  if (statusId === "provisionally_accessible") return "is-provisional";
  if (statusId === "not_suitable") return "is-not";
  return "is-review";
}

function updateInstallGuide() {
  if (!elements.installPanel) {
    return;
  }

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone;

  const shouldShow =
    state.installGuideForced ||
    (!isStandalone && (deferredInstallPrompt || isIOSDevice()));

  elements.installPanel.hidden = !shouldShow;
  elements.androidInstallButton.hidden = !deferredInstallPrompt;
  elements.installSteps.replaceChildren(...getInstallSteps().map(createInstallStep));
}

function getInstallSteps() {
  if (deferredInstallPrompt) {
    return ["Tap Install App", "Open it once while online", "Use it offline during shift"];
  }

  if (isIOSDevice()) {
    return ["Open in Safari", "Tap Share", "Add to Home Screen"];
  }

  return ["Open from the deployment link", "Use browser install", "Open once while online"];
}

function createInstallStep(text, index) {
  const item = document.createElement("div");
  item.className = "install-step";
  const number = document.createElement("span");
  number.textContent = String(index + 1);
  const copy = document.createElement("p");
  copy.textContent = text;
  item.append(number, copy);
  return item;
}

function isIOSDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

async function installAndroidApp() {
  if (!deferredInstallPrompt) {
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  updateInstallGuide();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") {
    return;
  }

  navigator.serviceWorker
    .register("./service-worker.js", { updateViaCache: "none" })
    .then((registration) => {
      if (registration.waiting) {
        showUpdateAvailable(registration.waiting);
      }

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) {
          return;
        }
        worker.addEventListener("statechange", () => {
          if (
            worker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            showUpdateAvailable(worker);
          }
        });
      });
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
    window.location.reload();
    return;
  }
  waitingServiceWorker.postMessage({ type: "SKIP_WAITING" });
}
