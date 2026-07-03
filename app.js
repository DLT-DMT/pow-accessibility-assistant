const DEFAULT_PROFILE = "standard";
const DEFAULT_SUPPORT_PROFILE = "rollator";
const APP_VERSION_FALLBACK = "3.0.0";

const RELEASE_NOTES = [
  {
    version: "3.0.0",
    items: [
      "Renamed the app to DMT FOH Shift Guide.",
      "Added track overview cards with RAG status and counters.",
      "Expanded cleaning references into operational cleaning task lists.",
      "Added Quick Reference for 999 calls, muster points, and radio codes.",
      "Added release notes beside the version number.",
    ],
  },
  {
    version: "2.0.0",
    items: [
      "Added guided setup for theatre, profile, support, and shift view.",
      "Moved the app onto refined master data.",
      "Added support-task filtering for another colleague's track and mobility.",
    ],
  },
  {
    version: "1.0.0",
    items: [
      "Created the first portable offline assistant from the workbook data.",
    ],
  },
];

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
  releaseDialog: document.querySelector("#releaseDialog"),
  releaseNotesButton: document.querySelector("#releaseNotesButton"),
  stepTabs: document.querySelector("#stepTabs"),
  updateButton: document.querySelector("#updateButton"),
  updatePanel: document.querySelector("#updatePanel"),
  versionLabel: document.querySelector("#versionLabel"),
  workflow: document.querySelector("#workflow"),
};

const stepLabels = ["Theatre", "About Me", "Support", "My Shift", "Quick Reference"];

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
    state.data.cleaningAssignments?.sort((a, b) => a.id.localeCompare(b.id));

    state.theatreId = state.data.theatres[0]?.id || "";
    state.trackId = getTracksForTheatre()[0]?.id || "";
    state.supportTrackId = state.trackId;
    state.supportProfileId = DEFAULT_SUPPORT_PROFILE;

    elements.androidInstallButton.addEventListener("click", installAndroidApp);
    elements.installHelpButton.addEventListener("click", () => {
      state.installGuideForced = true;
      updateInstallGuide();
      elements.installPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    elements.updateButton.addEventListener("click", applyAvailableUpdate);
    elements.releaseNotesButton.addEventListener("click", showReleaseNotes);
    elements.releaseDialog.querySelector("form").addEventListener("submit", () => {
      if (typeof elements.releaseDialog.close !== "function") {
        elements.releaseDialog.removeAttribute("open");
      }
    });

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
  const version = globalThis.POW_APP_VERSION || state.data?.meta?.version || APP_VERSION_FALLBACK;
  elements.versionLabel.textContent = `Version ${version}`;
}

function showReleaseNotes() {
  if (!elements.releaseDialog) {
    return;
  }
  const content = elements.releaseDialog.querySelector(".release-notes-content");
  content.replaceChildren(
    ...RELEASE_NOTES.map((release) => {
      const section = document.createElement("section");
      const heading = document.createElement("h3");
      heading.textContent = `Version ${release.version}`;
      const list = document.createElement("ul");
      release.items.forEach((item) => {
        const row = document.createElement("li");
        row.textContent = item;
        list.append(row);
      });
      section.append(heading, list);
      return section;
    }),
  );
  if (typeof elements.releaseDialog.showModal === "function") {
    elements.releaseDialog.showModal();
  } else {
    elements.releaseDialog.setAttribute("open", "");
  }
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
  } else if (state.step === 4) {
    elements.workflow.append(renderShiftScreen());
  } else {
    elements.workflow.append(renderQuickReferenceScreen());
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
  const panel = createPanel("Theatre", "Venue");
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
    createProfileControl("Select My Working Profile", state.profileId, (profileId) => {
      state.profileId = profileId;
    }),
    renderTrackOverview({
      profileId: state.profileId,
      selectedTrackId: state.trackId,
      onSelect: (trackId) => {
        state.trackId = trackId;
        if (!state.supportTrackId) {
          state.supportTrackId = trackId;
        }
        goToStep(3);
      },
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
      if (state.supportProfileId === DEFAULT_PROFILE) {
        state.supportProfileId = DEFAULT_SUPPORT_PROFILE;
      }
      render();
    }),
  );
  panel.append(toggle);

  if (state.supporting) {
    panel.append(
      createProfileControl("Supported Working Profile", state.supportProfileId, (profileId) => {
        state.supportProfileId = profileId;
      }, ["rollator", "wheelchair"]),
      renderTrackOverview({
        profileId: state.supportProfileId,
        selectedTrackId: state.supportTrackId,
        onSelect: (trackId) => {
          state.supportTrackId = trackId;
        },
        title: "Select Supported Track",
      }),
    );
  }

  panel.append(createActionRow([
    createButton("Back", "secondary-action", () => goToStep(2)),
    createButton("Start Shift", "primary-action", () => goToStep(4)),
  ]));
  return panel;
}

function renderTrackOverview({ profileId, selectedTrackId, onSelect, title = "Select Allocated Track" }) {
  const wrapper = document.createElement("section");
  wrapper.className = "track-overview";

  const heading = document.createElement("div");
  heading.className = "track-overview-heading";
  const label = document.createElement("span");
  label.className = "panel-label";
  label.textContent = title;
  const profile = document.createElement("strong");
  profile.textContent = `${profileIcon(profileId)} ${getProfile(profileId)?.label || ""}`;
  heading.append(label, profile);
  wrapper.append(heading);

  const grid = document.createElement("div");
  grid.className = "track-card-grid";
  getTracksForTheatre().forEach((track) => {
    const access = getTrackAccessibility(track.id, profileId);
    const statusId = access?.statusId || "review_required";
    const status = access?.status || "Review Required";
    const counters = getTrackStatusCounters(track.id, profileId);
    const button = document.createElement("button");
    button.type = "button";
    button.className = selectedTrackId === track.id
      ? `track-card active ${statusClass(statusId)}`
      : `track-card ${statusClass(statusId)}`;
    button.setAttribute("aria-pressed", String(selectedTrackId === track.id));
    button.addEventListener("click", () => onSelect(track.id));

    const top = document.createElement("div");
    top.className = "track-card-top";
    const name = document.createElement("strong");
    name.textContent = track.name;
    const rag = document.createElement("span");
    rag.className = `rag-indicator ${statusClass(statusId)}`;
    rag.textContent = ragLabel(statusId);
    top.append(name, rag);

    const statusLine = document.createElement("p");
    statusLine.className = "track-card-status";
    statusLine.textContent = status;

    const counterRow = document.createElement("div");
    counterRow.className = "counter-row";
    counterRow.append(
      createCounterChip("Suitable", counters.suitable),
      createCounterChip("Adjust", counters.adjust),
      createCounterChip("Not", counters.not),
    );

    button.append(top, statusLine, counterRow);
    grid.append(button);
  });

  wrapper.append(grid);
  return wrapper;
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
  subtitle.textContent = `${profileIcon(state.profileId)} ${profile?.label || "Standard Duties"}`;
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
    createButton("Quick Reference", "secondary-action", () => goToStep(5)),
    createButton("Start again", "text-action", () => {
      state.step = 1;
      state.profileId = DEFAULT_PROFILE;
      state.supporting = false;
      state.supportProfileId = DEFAULT_SUPPORT_PROFILE;
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
    createSummaryTile("Profile", `${profileIcon(state.profileId)} ${profile?.label || ""}`),
    createSummaryTile("Support tasks", String(supportTasks.length)),
  );
  if (supportTrack && supportProfile && state.supportProfileId !== DEFAULT_PROFILE) {
    summary.append(createSummaryTile("Supporting", `${profileIcon(state.supportProfileId)} ${supportTrack.name}`));
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

function renderQuickReferenceScreen() {
  const panel = createPanel("Quick Reference", "Operational aide memoire");
  panel.append(
    createReferenceSection("Calling 999", [
      "Reason for the call.",
      "Your name.",
      "Building name and address.",
      "Floor / room number, if known.",
      "Whether people remain inside the building.",
      "Remain on the telephone until instructed otherwise.",
    ]),
    createReferenceSection("Muster Points", [
      "Muster Point 1: The Londoner Hotel, Leicester Square.",
      "Muster Point 2: The Imperial Bar, Leicester Square.",
      "Muster Point 3: Any safe Delfont Mackintosh Theatres venue that can be reached safely.",
    ]),
    createRadioCodesSection(),
    createActionRow([
      createButton("Back to Shift", "secondary-action", () => goToStep(4)),
      createButton("Change details", "text-action", () => goToStep(2)),
    ]),
  );
  return panel;
}

function createReferenceSection(titleText, items) {
  const section = document.createElement("section");
  section.className = "reference-section";
  const title = document.createElement("h3");
  title.textContent = titleText;
  const list = document.createElement("ul");
  items.forEach((item) => {
    const row = document.createElement("li");
    row.textContent = item;
    list.append(row);
  });
  section.append(title, list);
  return section;
}

function createRadioCodesSection() {
  const section = document.createElement("section");
  section.className = "reference-section";
  const title = document.createElement("h3");
  title.textContent = "Radio Codes";
  const codes = document.createElement("div");
  codes.className = "radio-code-grid";
  [
    ["Mr Jet", "Fire"],
    ["Ms Green", "Urgent Security Response"],
  ].forEach(([code, meaning]) => {
    const item = document.createElement("article");
    const codeText = document.createElement("strong");
    codeText.textContent = code;
    const meaningText = document.createElement("span");
    meaningText.textContent = meaning;
    item.append(codeText, meaningText);
    codes.append(item);
  });
  section.append(title, codes);
  return section;
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
    const list = document.createElement("div");
    list.className = "task-stack";
    const renderedCleaningAreas = new Set();
    ownTasks.forEach((task) => {
      const visibleText = stripCleaningReference(task.text);
      const cleaningAreaIds = task.cleaningAreaIds?.length
        ? task.cleaningAreaIds
        : inferCleaningAreaIds(task.text);

      if (visibleText && !isAreaOnlyTask(visibleText, cleaningAreaIds)) {
        list.append(createTaskItem(visibleText));
      }

      cleaningAreaIds.forEach((areaId) => {
        const key = `${phase.id}:${areaId}`;
        if (renderedCleaningAreas.has(key)) {
          return;
        }
        const assignments = getCleaningAssignments(state.trackId, phase.id, areaId);
        if (!assignments.length) {
          return;
        }
        renderedCleaningAreas.add(key);
        list.append(renderCleaningBlock(areaId, assignments));
      });
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

function createProfileControl(labelText, selectedProfileId, onChange, allowedProfileIds = null) {
  const wrapper = document.createElement("div");
  wrapper.className = "field";
  const label = document.createElement("span");
  label.textContent = labelText;
  const controls = document.createElement("div");
  controls.className = "profile-grid";
  state.data.profiles
    .filter((profile) => !allowedProfileIds || allowedProfileIds.includes(profile.id))
    .forEach((profile) => {
    controls.append(createSegmentButton(`${profileIcon(profile.id)} ${profile.label}`, profile.id === selectedProfileId, () => {
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

function createCounterChip(label, value) {
  const chip = document.createElement("span");
  chip.className = "counter-chip";
  chip.textContent = `${label} ${value}`;
  return chip;
}

function createTaskItem(text) {
  const item = document.createElement("div");
  item.className = "task-item";
  item.textContent = text;
  return item;
}

function renderCleaningBlock(areaId, assignments) {
  const area = getCleaningArea(areaId);
  const block = document.createElement("section");
  block.className = "cleaning-block";
  const heading = document.createElement("h4");
  heading.textContent = area?.name || "Cleaning Location";
  const list = document.createElement("ul");
  uniqueByText(assignments).forEach((assignment) => {
    const row = document.createElement("li");
    row.textContent = assignment.text;
    list.append(row);
  });
  block.append(heading, list);
  return block;
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

function profileIcon(profileId) {
  if (profileId === "rollator") return "🦯";
  if (profileId === "wheelchair") return "🦽";
  return "👟";
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

function getTrackStatusCounters(trackId, profileId) {
  if (profileId === DEFAULT_PROFILE) {
    const phasesWithTasks = new Set(
      state.data.baselineTasks
        .filter((task) => task.trackId === trackId)
        .map((task) => task.phaseId),
    );
    return { suitable: phasesWithTasks.size, adjust: 0, not: 0 };
  }

  return state.data.phaseAccessibility
    .filter((item) => item.trackId === trackId && item.profileId === profileId)
    .reduce((counts, item) => {
      if (item.statusId === "suitable") {
        counts.suitable += 1;
      } else if (item.statusId === "not_suitable") {
        counts.not += 1;
      } else if (item.statusId !== "not_applicable") {
        counts.adjust += 1;
      }
      return counts;
    }, { suitable: 0, adjust: 0, not: 0 });
}

function getOwnTasksForPhase(phaseId) {
  return state.data.baselineTasks.filter(
    (task) => task.trackId === state.trackId && task.phaseId === phaseId,
  );
}

function getCleaningArea(areaId) {
  return state.data.cleaningAreas?.find((area) => area.id === areaId);
}

function getCleaningAssignments(trackId, phaseId, areaId) {
  return (state.data.cleaningAssignments || []).filter((assignment) => {
    if (assignment.areaId !== areaId) return false;
    if (assignment.phaseId !== phaseId) return false;
    if (assignment.assigneeType === "not_applicable") return false;
    return (
      assignment.matchedTrackId === trackId ||
      assignment.assigneeType === "all_tracks" ||
      assignment.assigneeType === "location"
    );
  });
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

function stripCleaningReference(text) {
  return String(text || "")
    .replace(/cleaning schedule reference:\s*/gi, "")
    .replace(/\bsee\s+[^.]*cleaning\s+(sheet|sheets|tasks)\.?/gi, "")
    .replace(/\s*-\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function inferCleaningAreaIds(text) {
  const source = String(text || "").toLowerCase().replace("folies", "follies");
  if (!/(cleaning schedule reference|see\s+[^.]*cleaning)/.test(source)) {
    return [];
  }

  const reference = source.match(/see\s+([^.]*)cleaning/);
  const target = reference?.[1] || source;
  const areaIds = [];
  if (target.includes("delfont")) areaIds.push("clean_delfont");
  if (target.includes("american")) areaIds.push("clean_american");
  if (target.includes("follies") || target.includes("erte") || target.includes("foyer")) {
    areaIds.push("clean_follies");
  }
  return [...new Set(areaIds)];
}

function isAreaOnlyTask(text, areaIds) {
  const normalized = normalizeTaskText(text);
  if (!normalized || !areaIds.length) {
    return false;
  }
  return areaIds.some((areaId) => {
    const area = getCleaningArea(areaId);
    return normalizeTaskText(area?.name) === normalized;
  });
}

function uniqueByText(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizeTaskText(item.text);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function ragLabel(statusId) {
  if (statusId === "suitable") return "Green";
  if (statusId === "not_suitable") return "Red";
  if (statusId === "review_required") return "Review";
  return "Amber";
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
