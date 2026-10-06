(() => {
  "use strict";
  const WORD = "TRAMBUSTISSIMO";
  const CONFIG = {"angle":234,"c1":"#49d5f8","c2":"#49d5f8","c3":"#ff684d","font":"space-grotesk","glow":20,"letterEnabled":true,"letterSpeed":31,"letterStagger":0.1,"letters":[{"fonts":["bodoni72","didot","libre-bodoni","fraunces"],"rate":1},{"fonts":["space-grotesk","bodoni72-old","newsreader","didot"],"rate":0.72},{"fonts":["libre-bodoni","bodoni72-smallcaps","palatino","space-grotesk"],"rate":1.25},{"fonts":["bodoni72","didot","libre-bodoni","fraunces"],"rate":0.9},{"fonts":["space-grotesk","bodoni72-old","newsreader","didot"],"rate":1},{"fonts":["libre-bodoni","bodoni72-smallcaps","palatino","space-grotesk"],"rate":0.72},{"fonts":["bodoni72","didot","libre-bodoni","fraunces"],"rate":1.25},{"fonts":["space-grotesk","bodoni72-old","newsreader","didot"],"rate":0.9},{"fonts":["libre-bodoni","bodoni72-smallcaps","palatino","space-grotesk"],"rate":1},{"fonts":["bodoni72","didot","libre-bodoni","fraunces"],"rate":0.72},{"fonts":["space-grotesk","bodoni72-old","newsreader","didot"],"rate":1.25},{"fonts":["libre-bodoni","bodoni72-smallcaps","palatino","space-grotesk"],"rate":0.9},{"fonts":["bodoni72","didot","libre-bodoni","fraunces"],"rate":1},{"fonts":["space-grotesk","bodoni72-old","newsreader","didot"],"rate":0.72}],"mode":"aurora","size":29,"speed":21,"tracking":4.25,"weight":800};
  const FONT_FAMILIES = {"space-grotesk":"\"Space Grotesk\", sans-serif","ibm-plex-sans":"\"IBM Plex Sans\", sans-serif","ibm-plex-mono":"\"IBM Plex Mono\", monospace","fraunces":"\"Fraunces\", serif","newsreader":"\"Newsreader\", serif","literata":"\"Literata\", serif","libre-bodoni":"\"Libre Bodoni\", \"Bodoni 72\", Didot, serif","bodoni72":"\"Bodoni 72\", Didot, serif","bodoni72-old":"\"Bodoni 72 Oldstyle\", \"Bodoni 72\", serif","bodoni72-smallcaps":"\"Bodoni 72 Smallcaps\", \"Bodoni 72\", serif","didot":"Didot, \"Bodoni 72\", serif","palatino":"Palatino, \"Palatino Linotype\", serif","hoefler":"\"Hoefler Text\", serif","cochin":"Cochin, serif","new-york":"\"New York\", serif","iowan":"\"Iowan Old Style\", serif","athelas":"Athelas, serif","baskerville":"Baskerville, serif","optima":"Optima, sans-serif","charter":"Charter, serif","georgia":"Georgia, serif","times":"\"Times New Roman\", Times, serif","helvetica":"\"Helvetica Neue\", Helvetica, Arial, sans-serif","avenir":"\"Avenir Next\", Avenir, sans-serif","futura":"Futura, \"Avenir Next\", sans-serif","gill":"\"Gill Sans\", \"Gill Sans MT\", sans-serif","menlo":"Menlo, Monaco, monospace"};

  function styleText() {
    let out = "";
    CONFIG.letters.forEach((cfg, i) => {
      const fs = cfg.fonts.map(k => FONT_FAMILIES[k] || FONT_FAMILIES[CONFIG.font]);
      const duration = Math.max(.1, CONFIG.letterSpeed * (Number(cfg.rate) || 1));
      const delay = i * CONFIG.letterStagger;
      out += `@keyframes trambLetter${i}{0%,24.99%{font-family:${fs[0]}}25%,49.99%{font-family:${fs[1]}}50%,74.99%{font-family:${fs[2]}}75%,100%{font-family:${fs[3]}}}`;
      out += `.products-brand .tramb-letter:nth-child(${i+1}){animation:trambLetter${i} ${duration}s steps(1,end) ${delay}s infinite!important}`;
    });
    out += "@media (prefers-reduced-motion:reduce){.products-brand .tramb-letter{animation:none!important}}";
    return out;
  }

  function letterize(holder) {
    if (!CONFIG.letterEnabled) return;
    if (holder.dataset.trambLetterized === "1") return;
    holder.textContent = "";
    [...WORD].forEach(char => {
      const span = document.createElement("span");
      span.className = "tramb-letter";
      span.textContent = char;
      holder.appendChild(span);
    });
    holder.dataset.trambLetterized = "1";
  }

  function updateSlots(holder) {
    const letters = [...holder.querySelectorAll(".tramb-letter")];
    if (!letters.length) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const family = FONT_FAMILIES[CONFIG.font] || FONT_FAMILIES["space-grotesk"];
    ctx.font = `${CONFIG.weight} ${CONFIG.size}px ${family}`;
    letters.forEach((el, i) => {
      const width = Math.max(1, ctx.measureText(WORD[i] || el.textContent || "M").width);
      el.style.setProperty("--tramb-slot-width", `${width}px`);
    });
  }

  function install() {
    const holder = document.querySelector(".products-brand__word");
    if (!holder) return;
    if (holder.textContent.trim() !== WORD || CONFIG.letterEnabled) holder.textContent = WORD;
    letterize(holder);
    let style = document.getElementById("trambustissimo-letter-choreography");
    if (!style) {
      style = document.createElement("style");
      style.id = "trambustissimo-letter-choreography";
      document.head.appendChild(style);
    }
    style.textContent = styleText();
    updateSlots(holder);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => updateSlots(holder));
    window.addEventListener("resize", () => updateSlots(holder), {passive:true});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, {once:true});
  else install();
})();
