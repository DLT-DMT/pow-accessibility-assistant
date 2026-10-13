const DEFAULT_PROFILE = "standard";
const DEFAULT_SUPPORT_PROFILE = "rollator";
const APP_VERSION_FALLBACK = "4.1.0";

const RELEASE_NOTES = [{version:"4.1.0",items:["Updated PET whole-track ratings using agreed working arrangements for both mobility profiles.","Added 105 searchable briefing answers, confirmed code words, muster points and Stage Door contact details.","Added RAG totals, compact track tiles and duty assessment tables.","Added Stalls Kiosk and Foyer Kiosk agreed role summaries."]},{version:"4.0.2",items:["Applied first shift feedback: shared ice cream preparation, tray delivery and room access notes.","Pick-up duties now show Amber with de-greeting as the adjusted role.","20 PET tracks changed from Red to Amber for stick/rollator use.","Door A and Door B are Amber for wheelchair use with confirmed adjustments and reassignments.","Adjustment notes now match your selected mobility profile; Standard Duties hides mobility notes."]},{version:"4.0.1",items:["Added a Prince Edward Theatre photo that switches with your selected venue."]},{version:"4.0.0",items:["Added Prince Edward Theatre with 30 positions and confirmed duty assessments.","Added mobility ratings and adjustment notes for each PET duty.","Added saved instruction feedback and phone sharing for both venues.","PET cleaning rota will be added when supplied."]},
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
  document.querySelector('.production').textContent = state.data.theatres.find(t => t.id === state.theatreId)?.name || 'Choose your theatre';
  const isPet = state.theatreId === 'THR002';
  document.body.classList.toggle('pet-design',isPet);
  const image = document.querySelector('.brand-image');
  image.hidden = false;
  image.src = isPet ? './prince-edward-theatre.jpg' : './assets/prince-of-wales-theatre-tower.jpg';
  image.alt = isPet ? 'Prince Edward Theatre exterior on Old Compton Street' : 'Prince of Wales Theatre exterior on Coventry Street';
  document.querySelector('.credits span').textContent = isPet
    ? 'DMT FOH Shift Guide. Photo: Adrian Pingstone, Wikimedia Commons, public domain (2005).'
    : 'DMT FOH Shift Guide. Photo crop: Bernard Gagnon, Wikimedia Commons, CC BY-SA 3.0 / GFDL.';
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
  } else if (state.step === 6 && isPet) {
    const panel=createPanel("Briefing Quiz", "105 original questions and answers");
    panel.append(createPetKnowledge());elements.workflow.append(panel);
  } else {
    elements.workflow.append(renderQuickReferenceScreen());
  }

  updateInstallGuide();
}

function renderStepTabs() {
  elements.stepTabs.replaceChildren(
    ...(state.theatreId === "THR002" ? [...stepLabels,"Briefing Quiz"] : stepLabels).map((label, index) => {
      const stepNumber = index + 1;
      const button = document.createElement("button");
      button.type = "button";
      button.className = stepNumber === state.step ? "step-tab active" : "step-tab";
      button.textContent = label;
      button.disabled = stepNumber > state.step && !(state.theatreId === "THR002" && stepNumber >= 5);
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

  if(state.theatreId === "THR002") panel.append(createButton("PET Quick Reference", "secondary-action", ()=>goToStep(5)));
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
  if(state.theatreId === "THR002") wrapper.append(renderPetTotals(profileId));

  const grid = document.createElement("div");
  grid.className = state.theatreId === "THR002" ? "track-card-grid pet-track-grid" : "track-card-grid";
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

    button.append(top, statusLine);
    if(state.theatreId !== "THR002") button.append(counterRow);
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
  if(track?.summaryOnly) panel.append(createReferenceSection("Agreed role summary",[track.notes]));

  if(state.theatreId === "THR002") panel.prepend(renderPetTotals(state.profileId));
  if(state.theatreId !== "THR002" || state.supporting) panel.append(renderShiftSummary(track, profile, supportTrack, supportProfile, supportTasks));

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

  if(state.theatreId === "THR002") {const guide=document.createElement("details");const guideLabel=document.createElement("summary");guideLabel.textContent="How to read your PET ratings";guide.append(guideLabel,createReferenceSection("Your PET guide",["Track colours describe the agreed working role. Green can include established adjustments or reassignments. The duty table shows the adjusted assignment. Reassigned duties are Amber, with the original Red limitation retained where relevant. My PEEP replaces standard evacuation and clearance duties.","The separate PET cleaning rota has not yet been supplied. Reassigned duties and other support arrangements are stated alongside the relevant instructions."]));panel.append(guide);}
  panel.append(runningOrder);
  if(state.theatreId === "THR002") panel.append(renderPetTrackNavigation());
  panel.append(createActionRow([
    createButton("Share shift feedback", "secondary-action", () => exportFeedback(false)),
    createButton("Download shift feedback", "secondary-action", () => exportFeedback(true)),
  ]));
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
  label.textContent = state.theatreId === "THR002" ? "Reason for "+ragLabel(access.statusId) : "Overall status";
  const status = document.createElement("strong");
  status.textContent = state.theatreId === "THR002" ? ragLabel(access.statusId)+" — "+access.status : access.status;
  const summary = document.createElement("p");
  summary.textContent = access.summary || access.requiredAdjustment;
  card.append(label, status, summary);
  return card;
}

function renderQuickReferenceScreen() {
  const panel = createPanel("Quick Reference", "Operational aide memoire");
  if(state.theatreId === "THR002") {
    panel.append(createReferenceSection("PET code words",["Mr Jet — Fire","Mr Wick — Bomb / suspicious package","Mrs Green — Aggressive or disruptive patron; security will attend"]),createPetMusterPoints(),createPetContacts(),createPetReferenceCollection(),createButton("Back to Shift","secondary-action",()=>goToStep(4)));return panel;
  }
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
    list.className = state.theatreId === "THR002" ? "task-stack pet-duty-table" : "task-stack";
    if(state.theatreId === "THR002"){list.setAttribute("role","table");list.setAttribute("aria-label",phase.label+" duties");const h=document.createElement("div");h.className="pet-duty-row pet-duty-head";h.setAttribute("role","row");for(const title of ["Instruction","Duty rating","My arrangement"]){const c=document.createElement("strong");c.setAttribute("role","columnheader");c.textContent=title;h.append(c);}list.append(h);}
    const renderedCleaningAreas = new Set();
    ownTasks.forEach((task) => {
      if (task.theatreId === "THR002") {
        list.append(renderPetDutyRow(task)); return;
      }
      const visibleText = stripCleaningReference(task.text);
      const cleaningAreaIds = task.cleaningAreaIds?.length
        ? task.cleaningAreaIds
        : inferCleaningAreaIds(task.text);

      if (visibleText && !isAreaOnlyTask(visibleText, cleaningAreaIds)) {
        const item=createTaskItem(visibleText);item.append(createFeedback(task));list.append(item);
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
      item.append(title, text, createFeedback({...task,id:`support-${task.id}`,text:task.text}));
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
    row.append(createFeedback({...assignment,id:`cleaning-${assignment.id}`,text:assignment.text}));
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
  if(getTrack(trackId)?.theatreId === "THR002") return state.data.baselineTasks.filter(t=>t.trackId===trackId).reduce((c,t)=>{const v=t.petStatuses?.[profileId];if(t.petReassigned?.[profileId]) c.adjust++;else if(v==="Green") c.suitable++;else if(v==="Red") c.not++;else if(v==="Amber") c.adjust++;return c;},{suitable:0,adjust:0,not:0});
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
  if(getTrack(trackId)?.theatreId === "THR002") return [];
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

function feedbackData(){try{return JSON.parse(localStorage.getItem("dmt-feedback-v4")||"{}");}catch{return {};}}
function createFeedback(task){
 const detail=document.createElement("details");const label=document.createElement("summary");label.textContent="Add feedback";
 const input=document.createElement("textarea");input.placeholder="Was this instruction accurate and viable with your mobility aid?";input.setAttribute("aria-label","Feedback: "+task.text);input.rows=3;input.style.width="100%";
 const theatreId=state.theatreId,trackId=task.id.startsWith("PET-Q")?"reference":state.trackId,profileId=task.id.startsWith("PET-Q")?"all":state.profileId,key=[theatreId,trackId,profileId,task.id].join(":");input.value=feedbackData()[key]?.feedback||"";
 const saved=document.createElement("small");saved.textContent="Saved on this device; export at the end of your shift.";
 input.addEventListener("input",()=>{const all=feedbackData();all[key]={theatreId,trackId,profileId,taskId:task.id,instruction:task.text,feedback:input.value,updatedAt:new Date().toISOString()};try{localStorage.setItem("dmt-feedback-v4",JSON.stringify(all));saved.textContent="Saved on this device.";}catch{saved.textContent="Could not save on this device. Copy your note before leaving.";}});
 detail.append(label,input,saved);return detail;
}
async function exportFeedback(downloadOnly=false){
 const notes=Object.values(feedbackData()).filter(n=>n.theatreId===state.theatreId&&n.trackId===state.trackId&&n.profileId===state.profileId&&n.feedback.trim());
 if(!notes.length){window.alert("Add feedback to an instruction first. Your notes are saved on this device.");return;}
 const venue=state.data.theatres.find(t=>t.id===state.theatreId)?.name;
 const track=getTrack(state.trackId)?.name,profile=getProfile(state.profileId)?.label;
 const text=["DMT FOH Shift Guide — feedback",`App version: ${APP_VERSION_FALLBACK}`,`Venue: ${venue}`,`Track: ${track}`,`Mobility: ${profile}`,`Exported: ${new Date().toISOString()}`,"",...notes.flatMap(n=>[`Instruction ID: ${n.taskId}`,`Instruction: ${n.instruction}`,`Feedback: ${n.feedback}`,`Updated: ${n.updatedAt}`,""])].join("\n");
 const filename="DMT-shift-feedback-"+new Date().toISOString().slice(0,10)+".txt";
 const file=new File([text],filename,{type:"text/plain"});
 try{if(!downloadOnly && navigator.canShare?.({files:[file]})){await navigator.share({title:`DMT feedback — ${track}`,files:[file]});return;}}catch(error){if(error.name==="AbortError")return;}
 const url=URL.createObjectURL(file),a=document.createElement("a");a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function petReferenceData(){try{return JSON.parse(localStorage.getItem("dmt-pet-reference-v1")||"{}");}catch{return {};}}
function createPetReferenceCollection(){
 const details=document.createElement("details");
 const title=document.createElement("summary");title.textContent="Add missing contact details or reference feedback";
 details.append(title,createPetReferenceFeedback());return details;
}
function createPetReferenceFeedback(){
 const section=document.createElement("section");section.className="reference-section";
 const title=document.createElement("h3");title.textContent="Gather PET quick reference information";
 const intro=document.createElement("p");intro.textContent="Use these prompts during your shift. Record telephone numbers or extensions and check who each number reaches. These are your collection notes until added to the guide.";
 section.append(title,intro);
 const prompts=[
 ["general-manager","Amy, General Manager — surname and telephone / extension"],
 ["theatre-manager","Sam Rippon, Theatre Manager — direct number / extension (if different from main)"],
 ["duty-manager","Duty Manager — telephone / extension"],
 
 ["bars-foyers","Each bar / foyer — list its name, telephone / extension and how to dial it"],
 
 
 ["other","Other quick reference feedback — missing information or corrections"]];
 const saved=document.createElement("p");saved.textContent="Notes save on this device as you type. Share or download them to send to yourself.";
 for(const [id,prompt] of prompts){const label=document.createElement("label");label.style.display="block";label.style.margin="16px 0";label.textContent=prompt;
 const input=document.createElement("textarea");input.rows=id==="bars-foyers"?5:2;input.style.width="100%";input.style.display="block";input.setAttribute("aria-label",prompt);input.placeholder=id==="bars-foyers"?"One location per line: name — number / extension — dialing instructions":"To collect on shift…";input.value=petReferenceData()[id]?.value||"";
 input.addEventListener("input",()=>{const all=petReferenceData();all[id]={prompt,value:input.value,updatedAt:new Date().toISOString()};try{localStorage.setItem("dmt-pet-reference-v1",JSON.stringify(all));saved.textContent="Saved on this device. Share or download when ready.";}catch{saved.textContent="Could not save. Copy your notes before leaving this page.";}});label.append(input);section.append(label);}
 section.append(saved,createActionRow([createButton("Share quick reference feedback","primary-action",()=>exportPetReference()),createButton("Download quick reference feedback","secondary-action",()=>exportPetReference(true))]));return section;
}
async function exportPetReference(downloadOnly=false){
 const notes=Object.values(petReferenceData()).filter(n=>n.value.trim());

 if(!notes.length){window.alert("Add a contact number or quick reference note first.");return;}
 const text=["DMT FOH Shift Guide — quick reference feedback",`App version: ${APP_VERSION_FALLBACK}`,"Venue: Prince Edward Theatre",`Exported: ${new Date().toISOString()}`,"",...notes.flatMap(n=>[n.prompt,n.value,`Updated: ${n.updatedAt}`,""])].join("\n");
 const file=new File([text],"PET-quick-reference-feedback-"+new Date().toISOString().slice(0,10)+".txt",{type:"text/plain"});
 try{if(!downloadOnly&&navigator.canShare?.({files:[file]})){await navigator.share({title:"PET quick reference feedback",files:[file]});return;}}catch(error){if(error.name==="AbortError")return;}
 const url=URL.createObjectURL(file),a=document.createElement("a");a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function renderPetTotals(profileId){
 const area=document.createElement("div");area.className="pet-totals";
 for(const [id,label] of [["suitable","Green"],["suitable_adjustments","Amber"],["not_suitable","Red"],["total","Total"]]){
  const n=id==="total"?getTracksForTheatre().length:getTracksForTheatre().filter(t=>getTrackAccessibility(t.id,profileId)?.statusId===id).length;
  const el=document.createElement("div");el.className="pet-total "+statusClass(id);const number=document.createElement("strong");number.textContent=n;const title=document.createElement("span");title.textContent=label;el.append(number,title);area.append(el);
 }
 const help=document.createElement("p");help.className="muted";help.textContent="Whole-track ratings include agreed arrangements. Open a track to see its duties and adjustments.";
 const wrap=document.createElement("div");wrap.append(area,help);return wrap;
}
function renderPetDutyRow(task){
 const row=document.createElement("div");row.className="pet-duty-row";row.setAttribute("role","row");
 const instruction=document.createElement("div");instruction.setAttribute("role","cell");instruction.dataset.label="Instruction";
 const t=document.createElement("p");t.textContent=task.text;instruction.append(t,createFeedback(task));
 const rating=document.createElement("div");rating.setAttribute("role","cell");rating.dataset.label="Duty rating";
 const original=task.petStatuses?.[state.profileId]||"Unassessed";const v=task.petReassigned?.[state.profileId]?"Amber":original;rating.append(createStatusPill(v,v==="Green"?"suitable":v==="Red"?"not_suitable":"suitable_adjustments"));
 if(original!==v&&original==="Red"){const small=document.createElement("small");small.textContent="Original duty: Red";rating.append(small);}
 const arrangement=document.createElement("div");arrangement.setAttribute("role","cell");arrangement.dataset.label="My arrangement";
 const treatment=task.petTreatment?.[state.profileId];
 if(state.profileId!==DEFAULT_PROFILE&&treatment&&treatment!=="As assigned")arrangement.append(createStatusPill(treatment,"suitable_adjustments"));
 const note=document.createElement("p");note.textContent=state.profileId===DEFAULT_PROFILE?"Standard duties":task.petAdjustmentNotes?.[state.profileId]||"No adjustment required.";arrangement.append(note);
 row.append(instruction,rating,arrangement);return row;
}
function createPetContacts(){
 const section=createReferenceSection("PET management and telephone numbers",[]);
 for(const contact of state.data.petContacts||[]){
  const card=document.createElement("div");card.style.margin="16px 0";
  const title=document.createElement("h4");title.textContent=contact.role+(contact.name?" — "+contact.name:"");card.append(title);
  const scope=document.createElement("p");scope.textContent=contact.scope;card.append(scope);
  for(const number of contact.phones){const line=document.createElement("p"),tel=document.createElement("a");tel.href="tel:+44"+number.replace(/\s/g,"").slice(1);tel.textContent="Main: "+number;line.append(tel);card.append(line);}
  if(!contact.phones.length){const note=document.createElement("p");note.textContent="Telephone / extension to collect";card.append(note);}
  section.append(card);
 }
 return section;
}
function createPetMusterPoints(){
 const section=document.createElement("section");section.className="reference-section";
 const title=document.createElement("h3");title.textContent="PET emergency muster points";section.append(title);
 for(const [name,destination] of [["1. St Patrick’s Church, Soho Square","St Patrick's Church, 21a Soho Square, London"],["2. Gielgud Theatre Stage Door, Winnett Street","Gielgud Theatre Stage Door, Winnett Street, London"],["3. Prince of Wales Theatre Stage Door, Whitcomb Street","Prince of Wales Theatre Stage Door, Whitcomb Street, London"]]){
  const p=document.createElement("p");p.textContent=name;const a=document.createElement("a");a.textContent="Open walking directions";a.target="_blank";a.rel="noopener";a.href="https://www.google.com/maps/dir/?api=1&origin="+encodeURIComponent("Prince Edward Theatre, Old Compton Street, London")+"&destination="+encodeURIComponent(destination)+"&travelmode=walking";section.append(p,a);
 }
 const note=document.createElement("p");note.className="muted";note.textContent="Maps need an internet connection. Suggested walking routes are not confirmed step-free evacuation routes. Follow your PEEP and current venue instructions.";section.append(note);return section;
}
function normalisePetSearch(value){return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();}
function petSearchQuestions(query,questions){
 const aliases={aed:"defibrillator",defib:"defibrillator",heart:"defibrillator",attack:"",cpr:"defibrillator",muster:"meeting",assembly:"meeting",bomb:"suspicious",phone:"phone",telephone:"phone"};
 const words=normalisePetSearch(query).split(" ").filter(Boolean).map(w=>aliases[w]??w).filter(Boolean);
 return questions.filter(q=>words.every(w=>normalisePetSearch(q.question+" "+q.answer+" "+q.category).includes(w)));
}
function createPetKnowledge(){
 const section=document.createElement("section");section.className="pet-knowledge";
 const title=document.createElement("h3");title.textContent="Find a briefing answer";
 const intro=document.createElement("p");intro.textContent="Search words from your question or an everyday topic. Answers come from the PET briefing sheet and are available offline after the guide has loaded.";
 const input=document.createElement("input");input.type="search";input.placeholder="Try defib, first aid, Stage Door…";input.setAttribute("aria-label","Search PET questions and answers");
 
 const shortcuts=document.createElement("div");shortcuts.className="action-row";
 for(const [label,value] of [["Defibrillator","defib"],["First aid","first aid"],["Stage Door","stage door"],["Muster points","meeting point"]])shortcuts.append(createButton(label,"text-action",()=>{input.value=value;draw();}));
 const count=document.createElement("p");count.setAttribute("role","status");count.setAttribute("aria-live","polite");
 const results=document.createElement("div");results.className="pet-answers";
 const questions=state.data.petBriefing?.questions||[];
 function draw(){
  results.replaceChildren();
  const found=petSearchQuestions(input.value,questions);count.textContent=found.length+" matching answers";
  if(!found.length){const p=document.createElement("p");p.textContent="No matching answer. Try fewer words or a different term.";results.append(p);return;}
  for(const q of found){const card=document.createElement("details");card.className="pet-answer";card.open=Boolean(input.value.trim());
   const heading=document.createElement("summary");heading.textContent=q.question;
   const a=document.createElement("p");a.className="pet-answer-text";a.textContent=q.answer;
   const source=document.createElement("small");source.textContent="PET briefing sheet · "+q.category;
   card.append(heading,a,source);
   if(q.caution){const n=document.createElement("p");n.className="pet-caution";n.textContent=q.caution;card.append(n);if(q.reference){const link=document.createElement("a");link.href=q.reference;link.target="_blank";link.rel="noopener";link.textContent="ProtectUK guidance";card.append(link);}}
   results.append(card);
  }
 }
 input.addEventListener("input",draw);
 section.append(title,intro,input,shortcuts,count,results);draw();return section;
}

function renderPetTrackNavigation(){
 const nav=document.createElement("nav");nav.className="pet-track-nav";nav.setAttribute("aria-label","PET tracks");
 for(const track of getTracksForTheatre()){
  const access=getTrackAccessibility(track.id,state.profileId);const b=createButton(track.name,"pet-nav-tile "+statusClass(access.statusId),()=>{state.trackId=track.id;goToStep(4);});
  b.setAttribute("aria-current",track.id===state.trackId?"page":"false");const badge=document.createElement("strong");badge.textContent=ragLabel(access.statusId);b.append(badge);nav.append(b);
 }return nav;
}
