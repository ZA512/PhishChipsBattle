/* A single silhouette joins the selected radio to its rules. Native radios keep
   keyboard navigation and focus independent of the decorative animation. */
window.PCBDifficultyPicker = (() => {
  const root = document.getElementById("difficulty-picker");
  const svg = root.querySelector("svg");
  const path = svg.querySelector("path");
  const panel = document.getElementById("difficulty-rules");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;
  let previous = null;

  function geometry() {
    const radio = root.querySelector("input:checked");
    if (!radio || root.querySelector(".difficulty-toggle").hidden) return null;
    const box = root.getBoundingClientRect();
    const tab = radio.nextElementSibling.getBoundingClientRect();
    const rules = panel.getBoundingClientRect();
    if (!box.width || !tab.width) return null;
    return {
      x: tab.left - box.left,
      y: tab.top - box.top,
      width: tab.width,
      panel: rules.top - box.top,
      total: box.width,
      height: box.height,
    };
  }
  function draw(g, collapse = 0) {
    const x = g.x,
      right = x + g.width,
      p = g.panel,
      h = g.height,
      w = g.total;
    const y = g.y + (p - g.y - 1) * collapse;
    const r = Math.min(12, (p - y) / 2, g.width / 2);
    const left = Math.min(r, x),
      end = Math.min(r, Math.max(0, w - right));
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    path.setAttribute(
      "d",
      `M 0 ${p + 12} Q 0 ${p} ${left} ${p}
      L ${x - left} ${p} Q ${x} ${p} ${x} ${p - r}
      L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y}
      L ${right - r} ${y} Q ${right} ${y} ${right} ${y + r}
      L ${right} ${p - r} Q ${right} ${p} ${right + end} ${p}
      L ${w - end} ${p} Q ${w} ${p} ${w} ${p + 12}
      L ${w} ${h - 14} Q ${w} ${h} ${w - 14} ${h}
      L 14 ${h} Q 0 ${h} 0 ${h - 14} Z`,
    );
  }
  function update(animate = false) {
    cancelAnimationFrame(frame);
    const next = geometry();
    root.classList.remove("is-flowing");
    root.classList.toggle("has-liquid", Boolean(next));
    if (!next) {
      previous = null;
      return;
    }
    const old = previous;
    previous = next;
    if (!animate || motion.matches || !old || old.x === next.x) {
      draw(next);
      return;
    }
    root.classList.add("is-flowing");
    const started = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - started) / 540);
      // The old neck drains into the panel, then rises beneath the new choice.
      const drain = t < 0.42;
      const u = drain ? t / 0.42 : (t - 0.42) / 0.58;
      const ease = u * u * (3 - 2 * u);
      draw(
        drain ? { ...next, x: old.x, width: old.width } : next,
        drain ? ease : 1 - ease,
      );
      if (t < 1) frame = requestAnimationFrame(tick);
      else {
        root.classList.remove("is-flowing");
        draw(next);
      }
    }
    frame = requestAnimationFrame(tick);
  }
  new ResizeObserver(() => {
    const next = geometry();
    // Updating the copy can resize the panel in the same frame as a selection.
    // Do not cancel a flow already measured with those exact dimensions.
    if (
      next &&
      previous &&
      Object.keys(next).every((key) => next[key] === previous[key])
    )
      return;
    update();
  }).observe(root);
  motion.addEventListener("change", () => update());
  return { update };
})();
