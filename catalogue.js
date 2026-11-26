let activeInstrument = null;
let pinned = false;

function selectInstrument(instrument, keepOpen = false) {
  if (activeInstrument !== instrument) {
    if (activeInstrument) {
      activeInstrument.querySelector(".instrument-toggle").setAttribute("aria-expanded", "false");
      activeInstrument.querySelector(".instrument-details").hidden = true;
    }

    if (instrument) {
      instrument.querySelector(".instrument-toggle").setAttribute("aria-expanded", "true");
      instrument.querySelector(".instrument-details").hidden = false;
    }
  }

  activeInstrument = instrument;
  pinned = keepOpen;
}

for (const instrument of document.querySelectorAll(".instrument")) {
  const toggle = instrument.querySelector(".instrument-toggle");
  const panel = instrument.querySelector(".instrument-details");

  instrument.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "mouse") return;

    document.documentElement.dataset.instrument = instrument.id;
    const activePanel = activeInstrument?.querySelector(".instrument-details");
    if (activeInstrument !== instrument && !activePanel?.contains(document.activeElement)) {
      selectInstrument(instrument);
    }
  });

  instrument.addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "mouse") return;

    delete document.documentElement.dataset.instrument;
    if (activeInstrument === instrument && !pinned && !panel.contains(document.activeElement)) {
      selectInstrument(null);
    }
  });

  toggle.addEventListener("click", () => {
    if (activeInstrument === instrument && pinned) {
      selectInstrument(null);
    } else {
      selectInstrument(instrument, true);
    }
  });

  instrument.addEventListener("focusout", (event) => {
    if (activeInstrument === instrument && !instrument.contains(event.relatedTarget) &&
        !pinned && !instrument.matches(":hover")) {
      selectInstrument(null);
    }
  });
}

document.addEventListener("click", (event) => {
  if (activeInstrument && !activeInstrument.contains(event.target)) {
    selectInstrument(null);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activeInstrument) {
    const panel = activeInstrument.querySelector(".instrument-details");
    if (panel.contains(document.activeElement)) {
      activeInstrument.querySelector(".instrument-toggle").focus();
    }
    selectInstrument(null);
  }
});
