"use strict";

const SVG_NS = "http://www.w3.org/2000/svg";
const WIDTH = 700;
const HEIGHT = 500;
const PLOT = { left: 76, right: 22, top: 52, bottom: 72 };

const COLORS = {
  grid: "#e1e7ec",
  text: "#344452",
  path: "#2774a8",
  footprint: "#258448",
  gadget: "#d07b24",
  start: "#16834a",
  goal: "#c4373f",
  origin: "#7951a1",
  adapted: "#d07b24",
  xAxis: "#c4373f",
  yAxis: "#21834b",
};

function svgElement(name, attributes = {}, text = "") {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  if (text) element.textContent = text;
  return element;
}

function setStatus(message, isError = false) {
  const status = document.querySelector("#status");
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function getBounds(series, includeOrigin = false) {
  const points = series.flat();
  if (includeOrigin) points.push({ x: 0, y: 0 });
  if (points.length === 0) points.push({ x: -1, y: -1 }, { x: 1, y: 1 });

  let minX = Math.min(...points.map((point) => point.x));
  let maxX = Math.max(...points.map((point) => point.x));
  let minY = Math.min(...points.map((point) => point.y));
  let maxY = Math.max(...points.map((point) => point.y));

  const xRange = Math.max(maxX - minX, 1e-9);
  const yRange = Math.max(maxY - minY, 1e-9);
  minX -= xRange * 0.08;
  maxX += xRange * 0.08;
  minY -= yRange * 0.08;
  maxY += yRange * 0.08;

  const plotWidth = WIDTH - PLOT.left - PLOT.right;
  const plotHeight = HEIGHT - PLOT.top - PLOT.bottom;
  const aspectRatio = plotWidth / plotHeight;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const viewXRange = maxX - minX;
  const viewYRange = maxY - minY;

  if (viewXRange / viewYRange < aspectRatio) {
    const adjusted = viewYRange * aspectRatio;
    minX = centerX - adjusted / 2;
    maxX = centerX + adjusted / 2;
  } else {
    const adjusted = viewXRange / aspectRatio;
    minY = centerY - adjusted / 2;
    maxY = centerY + adjusted / 2;
  }
  return { minX, maxX, minY, maxY };
}

function mapPoint(point, bounds) {
  const width = WIDTH - PLOT.left - PLOT.right;
  const height = HEIGHT - PLOT.top - PLOT.bottom;
  return {
    x: PLOT.left + ((point.x - bounds.minX) / (bounds.maxX - bounds.minX)) * width,
    y: PLOT.top + ((bounds.maxY - point.y) / (bounds.maxY - bounds.minY)) * height,
  };
}

function formatNumber(number) {
  return Number(number).toFixed(3);
}

function showTooltip(event, tooltip, plotWrap, text) {
  const rect = plotWrap.getBoundingClientRect();
  tooltip.textContent = text;
  tooltip.hidden = false;
  const x = event.clientX - rect.left + 12;
  const y = event.clientY - rect.top - tooltip.offsetHeight - 10;
  tooltip.style.left = `${Math.max(6, Math.min(x, rect.width - tooltip.offsetWidth - 6))}px`;
  tooltip.style.top = `${Math.max(6, y)}px`;
}

function addHoverPoint(
  svg,
  plotWrap,
  point,
  label,
  color,
  radius = 4,
  bold = false,
  tooltipContent = `${label}: (${formatNumber(point.value.x)} m, ${formatNumber(point.value.y)} m)`,
) {
  const tooltip = plotWrap.querySelector(".tooltip");
  const circle = svgElement("circle", {
    cx: point.pixel.x,
    cy: point.pixel.y,
    r: radius,
    fill: color,
    stroke: bold ? "#fff" : "none",
    "stroke-width": bold ? 2 : 0,
    class: "plot-point",
    tabindex: 0,
    role: "img",
    "aria-label": tooltipContent,
  });
  circle.addEventListener("pointerenter", (event) =>
    showTooltip(event, tooltip, plotWrap, tooltipContent),
  );
  circle.addEventListener("pointermove", (event) =>
    showTooltip(event, tooltip, plotWrap, tooltipContent),
  );
  circle.addEventListener("pointerleave", () => {
    tooltip.hidden = true;
  });
  circle.addEventListener("focus", () => {
    const rect = circle.getBoundingClientRect();
    showTooltip(
      { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 },
      tooltip,
      plotWrap,
      tooltipContent,
    );
  });
  circle.addEventListener("blur", () => {
    tooltip.hidden = true;
  });
  svg.append(circle);
}

function drawAxes(
  svg,
  bounds,
  xLabel = "x",
  yLabel = "y",
  formatXTick = formatNumber,
) {
  for (let tick = 0; tick <= 5; tick += 1) {
    const fraction = tick / 5;
    const x = PLOT.left + fraction * (WIDTH - PLOT.left - PLOT.right);
    const y = HEIGHT - PLOT.bottom - fraction * (HEIGHT - PLOT.top - PLOT.bottom);
    const xValue = bounds.minX + fraction * (bounds.maxX - bounds.minX);
    const yValue = bounds.minY + fraction * (bounds.maxY - bounds.minY);
    svg.append(
      svgElement("line", { x1: x, y1: PLOT.top, x2: x, y2: HEIGHT - PLOT.bottom, stroke: COLORS.grid }),
      svgElement("line", { x1: PLOT.left, y1: y, x2: WIDTH - PLOT.right, y2: y, stroke: COLORS.grid }),
      svgElement("text", { x, y: HEIGHT - PLOT.bottom + 22, "text-anchor": "middle", fill: COLORS.text, "font-size": 11 }, formatXTick(xValue)),
      svgElement("text", { x: PLOT.left - 10, y: y + 4, "text-anchor": "end", fill: COLORS.text, "font-size": 11 }, formatNumber(yValue)),
    );
  }
  svg.append(
    svgElement("rect", {
      x: PLOT.left,
      y: PLOT.top,
      width: WIDTH - PLOT.left - PLOT.right,
      height: HEIGHT - PLOT.top - PLOT.bottom,
      fill: "none",
      stroke: COLORS.text,
    }),
    svgElement("text", { x: WIDTH / 2, y: HEIGHT - 13, "text-anchor": "middle", fill: COLORS.text, "font-size": 13 }, xLabel),
    svgElement("text", { x: 22, y: HEIGHT / 2, "text-anchor": "middle", fill: COLORS.text, "font-size": 13, transform: `rotate(-90 22 ${HEIGHT / 2})` }, yLabel),
  );
}

function drawLegend(svg, items) {
  const y = HEIGHT - 37;
  let x = PLOT.left + 4;
  for (const item of items) {
    const entry = svgElement("g", {
      role: "button",
      tabindex: 0,
      "aria-label": `Toggle ${item.label}`,
      "aria-pressed": "true",
      "data-legend-target": item.target,
      class: "plot-legend-item",
    });
    entry.append(
      svgElement("line", { x1: x, y1: y - 4, x2: x + 20, y2: y - 4, stroke: item.color, "stroke-width": 3 }),
      svgElement("text", { x: x + 26, y, fill: COLORS.text, "font-size": 12 }, item.label),
    );
    const toggleSeries = () => {
      const series = svg.querySelector(`[data-series="${item.target}"]`);
      const isVisible = series.getAttribute("display") !== "none";
      if (isVisible) {
        series.setAttribute("display", "none");
      } else {
        series.removeAttribute("display");
      }
      entry.setAttribute("aria-pressed", String(!isVisible));
      entry.classList.toggle("is-hidden", isVisible);
    };
    entry.addEventListener("click", toggleSeries);
    entry.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleSeries();
      }
    });
    svg.append(entry);
    x += 38 + item.label.length * 7.2;
  }
}

function createSeriesGroup(svg, key) {
  const group = svgElement("g", { "data-series": key });
  svg.append(group);
  return group;
}

function drawPathSeries(
  svg,
  plotWrap,
  waypoints,
  bounds,
  key,
  label,
  color,
  waypointIndices = waypoints.map((_, index) => index),
) {
  const group = createSeriesGroup(svg, key);
  const pixels = waypoints.map((value) => ({ value, pixel: mapPoint(value, bounds) }));
  if (pixels.length > 1) {
    group.append(svgElement("polyline", {
      points: pixels.map(({ pixel }) => `${pixel.x},${pixel.y}`).join(" "),
      fill: "none",
      stroke: color,
      "stroke-width": key === "original-path" ? 2 : 3,
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
    }));
  }
  pixels.forEach((point, index) => {
    addHoverPoint(
      group,
      plotWrap,
      point,
      `${label} waypoint [${waypointIndices[index]}]`,
      color,
      3,
    );
  });
  return { group, pixels };
}

function drawPolygon(svg, plotWrap, points, bounds, label, color, close = false) {
  const group = createSeriesGroup(svg, label);
  const pixels = points.map((value) => ({ value, pixel: mapPoint(value, bounds) }));
  if (pixels.length > 1) {
    const sequence = close ? [...pixels, pixels[0]] : pixels;
    group.append(svgElement("polyline", {
      points: sequence.map(({ pixel }) => `${pixel.x},${pixel.y}`).join(" "),
      fill: "none",
      stroke: color,
      "stroke-width": 3,
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
    }));
  }
  pixels.forEach((point, index) => {
    addHoverPoint(group, plotWrap, point, `${label} [${index}]`, color, 5);
  });
}

function drawBaseLink(svg, plotWrap, bounds) {
  const group = createSeriesGroup(svg, "base-link");
  const origin = { x: 0, y: 0 };
  const pixel = mapPoint(origin, bounds);
  const axisLength = 48;
  const xEnd = { x: pixel.x + axisLength, y: pixel.y };
  const yEnd = { x: pixel.x, y: pixel.y - axisLength };
  group.append(
    svgElement("defs"),
  );
  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = svgElement("defs");
    svg.prepend(defs);
  }
  for (const [id, color] of [["x-arrow", COLORS.xAxis], ["y-arrow", COLORS.yAxis]]) {
    const marker = svgElement("marker", { id, markerWidth: 7, markerHeight: 7, refX: 5, refY: 3.5, orient: "auto", markerUnits: "strokeWidth" });
    marker.append(svgElement("path", { d: "M0,0 L0,7 L7,3.5 z", fill: color }));
    defs.append(marker);
  }
  svg.append(
    svgElement("line", { x1: pixel.x, y1: pixel.y, x2: xEnd.x, y2: xEnd.y, stroke: COLORS.xAxis, "stroke-width": 2, "marker-end": "url(#x-arrow)" }),
    svgElement("line", { x1: pixel.x, y1: pixel.y, x2: yEnd.x, y2: yEnd.y, stroke: COLORS.yAxis, "stroke-width": 2, "marker-end": "url(#y-arrow)" }),
    svgElement("text", { x: xEnd.x + 6, y: xEnd.y + 5, fill: COLORS.xAxis, "font-size": 13, "font-weight": 700 }, "x"),
    svgElement("text", { x: yEnd.x - 6, y: yEnd.y - 7, fill: COLORS.yAxis, "font-size": 13, "font-weight": 700 }, "y"),
    svgElement("text", { x: pixel.x + 9, y: pixel.y + 20, fill: COLORS.origin, "font-size": 12 }, "base_link (0,0)"),
  );
  addHoverPoint(group, plotWrap, { value: origin, pixel }, "base_link origin", COLORS.origin, 6, true);
}

function renderCleanedArea(svg, polygonGeometry, bounds) {
  const group = createSeriesGroup(svg, "cleaned-area");
  const pathData = polygonGeometry.map((polygon) =>
    polygon.map((ring) => {
      const pixels = ring.map((point) => mapPoint(point, bounds));
      return `M ${pixels.map(({ x, y }) => `${x} ${y}`).join(" L ")} Z`;
    }).join(" "),
  ).join(" ");
  if (pathData) {
    group.append(svgElement("path", {
      d: pathData,
      fill: "#4b9d79",
      "fill-opacity": 0.3,
      "fill-rule": "evenodd",
      stroke: "#267653",
      "stroke-width": 1.5,
      "pointer-events": "none",
      "aria-label": "Calculated cleaned area",
    }));
  }
}

function renderPath(waypoints, subsampledWaypointIndices, cleanedAreaGeometry) {
  const svg = document.querySelector("#path-plot");
  const wrap = svg.parentElement;
  const cleanedAreaPoints = cleanedAreaGeometry.flat(2);
  const bounds = getBounds([waypoints, cleanedAreaPoints]);
  drawAxes(svg, bounds, "x (m)", "y (m)");
  svg.append(svgElement("text", { x: 76, y: 28, fill: COLORS.text, "font-size": 15, "font-weight": 700 }, "Robot path · world frame"));
  renderCleanedArea(svg, cleanedAreaGeometry, bounds);
  const original = drawPathSeries(
    svg, wrap, waypoints, bounds, "original-path", "Recorded path", COLORS.path,
  );
  if (original.pixels.length > 0) {
    addHoverPoint(original.group, wrap, original.pixels[0], "start (world frame)", COLORS.start, 8, true);
    if (original.pixels.length > 1) {
      addHoverPoint(original.group, wrap, original.pixels[original.pixels.length - 1], "goal (world frame)", COLORS.goal, 8, true);
    }
  }
  const filteredWaypoints = subsampledWaypointIndices.map((index) => waypoints[index]);
  drawPathSeries(
    svg,
    wrap,
    filteredWaypoints,
    bounds,
    "filtered-path",
    "Filtered path (0.01 m)",
    COLORS.adapted,
    subsampledWaypointIndices,
  );
  drawLegend(svg, [
    { label: "Recorded path", color: COLORS.path, target: "original-path" },
    { label: "Filtered path (0.01 m)", color: COLORS.adapted, target: "filtered-path" },
    { label: "Cleaned area", color: "#267653", target: "cleaned-area" },
  ]);
}

function renderGeometry(robot, gadget) {
  const svg = document.querySelector("#geometry-plot");
  const wrap = svg.parentElement;
  const bounds = getBounds([robot, gadget], true);
  drawAxes(svg, bounds, "x (m)", "y (m)");
  svg.append(svgElement("text", { x: 76, y: 28, fill: COLORS.text, "font-size": 15, "font-weight": 700 }, "Robot footprint and cleaning gadget"));
  drawPolygon(svg, wrap, robot, bounds, "robot footprint (base_link)", COLORS.footprint, true);
  drawPolygon(svg, wrap, gadget, bounds, "cleaning gadget (base_link)", COLORS.gadget);
  drawBaseLink(svg, wrap, bounds);
  drawLegend(svg, [
    { label: "robot footprint", color: COLORS.footprint, target: "robot footprint (base_link)" },
    { label: "cleaning gadget", color: COLORS.gadget, target: "cleaning gadget (base_link)" },
    { label: "base_link origin", color: COLORS.origin, target: "base-link" },
  ]);
}

function renderHeadings(headings, subsampledHeadingEstimation) {
  const svg = document.querySelector("#heading-plot");
  const wrap = svg.parentElement;
  const series = [
    {
      label: "initial",
      color: COLORS.origin,
      headings,
    },
    {
      label: "0.01 m subsampling, 0.03 m window",
      color: COLORS.adapted,
      headings: subsampledHeadingEstimation.headings,
      values: subsampledHeadingEstimation.headings.map((heading, index) => ({
        x: subsampledHeadingEstimation.waypointIndices[index],
        y: heading,
      })),
    },
  ].map((item) => ({
    ...item,
    values: item.values ?? item.headings.map((heading, index) => ({ x: index, y: heading })),
  }));
  const bounds = {
    minX: -0.5,
    maxX: Math.max(0.5, headings.length - 0.5),
    minY: -Math.PI,
    maxY: Math.PI,
  };
  drawAxes(
    svg,
    bounds,
    "waypoint index",
    "heading (rad)",
    (value) => String(Math.max(
      0,
      Math.min(Math.max(0, headings.length - 1), Math.round(value)),
    )),
  );
  svg.append(svgElement("text", { x: 76, y: 28, fill: COLORS.text, "font-size": 15, "font-weight": 700 }, "Heading estimates · world frame"));
  for (const item of series) {
    if (item.values.length < 2) continue;
    const group = createSeriesGroup(svg, item.label);
    group.append(svgElement("polyline", {
      points: item.values.map((value) => {
        const pixel = mapPoint(value, bounds);
        return `${pixel.x},${pixel.y}`;
      }).join(" "),
      fill: "none",
      stroke: item.color,
      "stroke-width": 2,
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
    }));
  }
  for (const item of series) {
    item.values.forEach((value, index) => {
      const pixel = mapPoint(value, bounds);
      const radians = item.headings[index];
      const degrees = radians * 180 / Math.PI;
      addHoverPoint(
        svg.querySelector(`[data-series="${item.label}"]`),
        wrap,
        { value, pixel },
        `waypoint [${value.x}] ${item.label}`,
        item.color,
        4,
        false,
        `waypoint [${value.x}] ${item.label}: ${formatNumber(radians)} rad (${formatNumber(degrees)}°)`,
      );
    });
  }
  drawLegend(svg, series.map(({ label, color }) => ({
    label,
    color,
    target: label,
  })));
}

function renderCurvature(approximations) {
  const svg = document.querySelector("#curvature-plot");
  const values = approximations.map((item) => ({
    x: item.startWaypointIndex,
    y: item.curvature,
  }));
  const minX = values.length ? values[0].x : 0;
  const maxX = values.length ? values[values.length - 1].x : 1;
  let minY = values.length ? Math.min(...values.map((item) => item.y)) : -1;
  let maxY = values.length ? Math.max(...values.map((item) => item.y)) : 1;
  const yPadding = Math.max((maxY - minY) * 0.08, 1e-6);
  minY -= yPadding;
  maxY += yPadding;
  const bounds = {
    minX: minX - 0.5,
    maxX: Math.max(minX + 0.5, maxX + 0.5),
    minY,
    maxY,
  };
  drawAxes(
    svg,
    bounds,
    "starting waypoint index",
    "curvature (1/m)",
    (value) => String(Math.max(minX, Math.min(maxX, Math.round(value)))),
  );
  svg.append(svgElement(
    "text",
    { x: 76, y: 28, fill: COLORS.text, "font-size": 15, "font-weight": 700 },
    "Curvature approximation by filtered path segment",
  ));
  const group = createSeriesGroup(svg, "curvature");
  if (values.length > 1) {
    group.append(svgElement("polyline", {
      points: values.map((value) => {
        const pixel = mapPoint(value, bounds);
        return `${pixel.x},${pixel.y}`;
      }).join(" "),
      fill: "none",
      stroke: COLORS.origin,
      "stroke-width": 2,
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
    }));
  }
  values.forEach((value, index) => {
    const approximation = approximations[index];
    const pixel = mapPoint(value, bounds);
    addHoverPoint(
      group,
      svg.parentElement,
      { value, pixel },
      `waypoints ${approximation.startWaypointIndex}–${approximation.endWaypointIndex}`,
      COLORS.origin,
      4,
      false,
      `waypoints ${approximation.startWaypointIndex}–${approximation.endWaypointIndex}: ` +
        `${approximation.curvature.toPrecision(6)} 1/m ` +
        `(Δθ ${approximation.headingChange.toPrecision(6)} rad, ` +
        `Δs ${approximation.distance.toPrecision(6)} m)`,
    );
  });
  drawLegend(svg, [{
    label: "Signed curvature",
    color: COLORS.origin,
    target: "curvature",
  }]);
}

function renderVelocities(velocities) {
  const svg = document.querySelector("#velocity-plot");
  const values = velocities.map((item) => ({
    x: item.waypointIndex,
    y: item.speed,
  }));
  const minX = values.length ? values[0].x : 0;
  const maxX = values.length ? values[values.length - 1].x : 1;
  const bounds = {
    minX: minX - 0.5,
    maxX: Math.max(minX + 0.5, maxX + 0.5),
    minY: 0,
    maxY: Math.max(1.2, ...values.map((item) => item.y)) * 1.05,
  };
  drawAxes(
    svg,
    bounds,
    "waypoint index",
    "speed (m/s)",
    (value) => String(Math.max(minX, Math.min(maxX, Math.round(value)))),
  );
  svg.append(svgElement(
    "text",
    { x: 76, y: 28, fill: COLORS.text, "font-size": 15, "font-weight": 700 },
    "Estimated velocity at filtered waypoints",
  ));
  const group = createSeriesGroup(svg, "velocity");
  if (values.length > 1) {
    group.append(svgElement("polyline", {
      points: values.map((value) => {
        const pixel = mapPoint(value, bounds);
        return `${pixel.x},${pixel.y}`;
      }).join(" "),
      fill: "none",
      stroke: COLORS.adapted,
      "stroke-width": 2,
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
    }));
  }
  values.forEach((value, index) => {
    const velocity = velocities[index];
    const pixel = mapPoint(value, bounds);
    addHoverPoint(
      group,
      svg.parentElement,
      { value, pixel },
      `waypoint ${velocity.waypointIndex}`,
      COLORS.adapted,
      4,
      false,
      `waypoint ${velocity.waypointIndex}: ${velocity.speed.toPrecision(6)} m/s ` +
        `(curvature ${velocity.curvature.toPrecision(6)} 1/m)`,
    );
  });
  drawLegend(svg, [{
    label: "Estimated speed",
    color: COLORS.adapted,
    target: "velocity",
  }]);
}

function validatePointData(data) {
  const pointKeys = ["path", "robot", "cleaning_gadget"];
  for (const key of pointKeys) {
    if (!Array.isArray(data[key]) || !data[key].every(
      (point) => Array.isArray(point) && point.length === 2 &&
        point.every((coordinate) => Number.isFinite(coordinate)),
    )) {
      throw new Error(`Invalid or missing "${key}" point data.`);
    }
  }
  return {
    path: data.path.map(([x, y]) => ({ x, y })),
    robot: data.robot.map(([x, y]) => ({ x, y })),
    cleaningGadget: data.cleaning_gadget.map(([x, y]) => ({ x, y })),
  };
}

function validateAnalysisData(data, pathLength) {
  const hasValidStatistics = (statistics, headingCount) =>
    statistics === null
      ? headingCount < 2
      : statistics &&
        typeof statistics === "object" &&
        ["minimum", "maximum", "mean"].every(
          (key) => Number.isFinite(statistics[key]) &&
            statistics[key] >= 0,
        );
  const waypointDistanceStatistics = data.waypoint_distance_statistics;
  const subsampledEstimation = data.subsampled_heading_estimation;
  const curvatureApproximations = data.curvature_approximations;
  const waypointVelocities = data.waypoint_velocities;
  const speedModel = data.speed_model;
  const cleanedAreaGeometry = data.cleaned_area_geometry;
  const validCleanedAreaGeometry = Array.isArray(cleanedAreaGeometry) &&
    cleanedAreaGeometry.every((polygon) =>
      Array.isArray(polygon) && polygon.length > 0 &&
      polygon.every((ring) =>
        Array.isArray(ring) && ring.length >= 4 &&
        ring.every((point) =>
          Array.isArray(point) && point.length === 2 &&
          point.every(Number.isFinite),
        ),
      ),
    );
  const validSubsampledEstimation = subsampledEstimation &&
    subsampledEstimation.minimum_waypoint_distance === 0.01 &&
    subsampledEstimation.window_distance === 0.03 &&
    Array.isArray(subsampledEstimation.waypoint_indices) &&
    Array.isArray(subsampledEstimation.headings) &&
    subsampledEstimation.waypoint_indices.length ===
      subsampledEstimation.headings.length &&
    subsampledEstimation.waypoint_indices.every(
      (index, position, indices) =>
        Number.isInteger(index) && index >= 0 && index < pathLength &&
        (position === 0 || index > indices[position - 1]),
    ) &&
    subsampledEstimation.headings.every(Number.isFinite) &&
    hasValidStatistics(
      subsampledEstimation.heading_change_statistics,
      subsampledEstimation.headings.length,
    );
  const validCurvatureApproximations =
    Array.isArray(curvatureApproximations) &&
    curvatureApproximations.length ===
      Math.max(0, subsampledEstimation?.waypoint_indices?.length - 1) &&
    curvatureApproximations.every((approximation, index) =>
      approximation.start_waypoint_index ===
        subsampledEstimation.waypoint_indices[index] &&
      approximation.end_waypoint_index ===
        subsampledEstimation.waypoint_indices[index + 1] &&
      Number.isFinite(approximation.heading_change) &&
      approximation.heading_change >= -Math.PI &&
      approximation.heading_change <= Math.PI &&
      Number.isFinite(approximation.distance) &&
      approximation.distance > 0 &&
      Number.isFinite(approximation.curvature) &&
      Math.abs(
        approximation.curvature -
          approximation.heading_change / approximation.distance,
      ) < 1e-9,
    );
  const validWaypointVelocities =
    Array.isArray(waypointVelocities) &&
    waypointVelocities.length === subsampledEstimation?.waypoint_indices?.length &&
    waypointVelocities.every((velocity, index) => {
      const curvature = index === 0
        ? curvatureApproximations[0]?.curvature
        : curvatureApproximations[index - 1]?.curvature;
      return velocity.waypoint_index ===
          subsampledEstimation.waypoint_indices[index] &&
        Number.isFinite(velocity.curvature) &&
        velocity.curvature === curvature &&
        Number.isFinite(velocity.speed) && velocity.speed > 0;
    });
  const validSpeedModel = speedModel &&
    speedModel.maximum_speed === 1.1 &&
    speedModel.minimum_speed === 0.15 &&
    speedModel.curvature_critical === 0.5 &&
    speedModel.curvature_maximum === 10;
  if (!Number.isFinite(data.path_length) ||
      !Number.isFinite(data.cleaned_area) ||
      data.cleaned_area < 0 ||
      !Number.isFinite(data.traversal_time) ||
      data.traversal_time < 0 ||
      !validCurvatureApproximations ||
      !validWaypointVelocities ||
      !validSpeedModel ||
      !validCleanedAreaGeometry ||
      !Array.isArray(data.headings) ||
      data.headings.length !== pathLength ||
      !data.headings.every(Number.isFinite) ||
      !waypointDistanceStatistics ||
      !["minimum", "maximum", "mean"].every(
        (key) => Number.isFinite(waypointDistanceStatistics[key]) &&
          waypointDistanceStatistics[key] >= 0,
      ) ||
      !hasValidStatistics(data.heading_change_statistics, pathLength) ||
      !validSubsampledEstimation) {
    throw new Error("Invalid or missing C++-computed path length or headings.");
  }
  return {
    pathLength: data.path_length,
    cleanedArea: data.cleaned_area,
    cleanedAreaGeometry: cleanedAreaGeometry.map((polygon) =>
      polygon.map((ring) => ring.map(([x, y]) => ({ x, y }))),
    ),
    curvatureApproximations: curvatureApproximations.map((item) => ({
      startWaypointIndex: item.start_waypoint_index,
      endWaypointIndex: item.end_waypoint_index,
      headingChange: item.heading_change,
      distance: item.distance,
      curvature: item.curvature,
    })),
    traversalTime: data.traversal_time,
    waypointVelocities: waypointVelocities.map((item) => ({
      waypointIndex: item.waypoint_index,
      curvature: item.curvature,
      speed: item.speed,
    })),
    headings: data.headings,
    waypointDistanceStatistics,
    headingChangeStatistics: data.heading_change_statistics,
    subsampledHeadingEstimation: {
      waypointIndices: subsampledEstimation.waypoint_indices,
      headings: subsampledEstimation.headings,
      headingChangeStatistics:
        subsampledEstimation.heading_change_statistics,
    },
  };
}

function renderHeadingChangeStatistics(statistics, subsampledEstimation) {
  const section = document.querySelector("#heading-change-summary");
  const rows = [
    {
      label: "Original headings",
      statistics,
    },
    {
      label: "0.01 m subsampling, 0.03 m window",
      statistics: subsampledEstimation.headingChangeStatistics,
    },
  ];
  const body = section.querySelector("tbody");
  for (const row of rows) {
    const tableRow = document.createElement("tr");
    const label = document.createElement("th");
    label.scope = "row";
    label.textContent = row.label;
    tableRow.append(label);
    for (const key of ["minimum", "maximum", "mean"]) {
      const cell = document.createElement("td");
      cell.textContent = row.statistics
        ? `${row.statistics[key].toPrecision(6)} rad`
        : "—";
      tableRow.append(cell);
    }
    body.append(tableRow);
  }
  section.hidden = false;
}

function renderWaypointDistanceStatistics(statistics) {
  const section = document.querySelector("#waypoint-distance-summary");
  const body = section.querySelector("tbody");
  const row = document.createElement("tr");
  const label = document.createElement("th");
  label.scope = "row";
  label.textContent = "Consecutive waypoints";
  row.append(label);
  for (const key of ["minimum", "maximum", "mean"]) {
    const cell = document.createElement("td");
    cell.textContent = `${statistics[key].toPrecision(6)} m`;
    row.append(cell);
  }
  body.append(row);
  section.hidden = false;
}

Promise.all([
  fetch("../data/short.json").then((response) => {
    if (!response.ok) {
      throw new Error(`Could not load ../data/short.json (${response.status}).`);
    }
    return response.json();
  }).then(validatePointData),
  fetch("analysis.json").then((response) => {
    if (!response.ok) {
      throw new Error(`Could not load analysis.json (${response.status}). Run the C++ data_analysis program first.`);
    }
    return response.json();
  }),
])
  .then((response) => {
    const [pointData, analysisData] = response;
    return {
      ...pointData,
      ...validateAnalysisData(analysisData, pointData.path.length),
    };
  })
  .then((data) => {
    renderPath(
      data.path,
      data.subsampledHeadingEstimation.waypointIndices,
      data.cleanedAreaGeometry,
    );
    renderGeometry(data.robot, data.cleaningGadget);
    renderHeadings(data.headings, data.subsampledHeadingEstimation);
    renderCurvature(data.curvatureApproximations);
    renderVelocities(data.waypointVelocities);
    renderHeadingChangeStatistics(
      data.headingChangeStatistics,
      data.subsampledHeadingEstimation,
    );
    renderWaypointDistanceStatistics(data.waypointDistanceStatistics);
    const pathLength = document.querySelector("#path-length");
    pathLength.textContent =
      `Filtered path length: ${formatNumber(data.pathLength)} m`;
    pathLength.hidden = false;
    const cleanedArea = document.querySelector("#cleaned-area");
    cleanedArea.textContent =
      `Calculated cleaned area: ${formatNumber(data.cleanedArea)} m²`;
    cleanedArea.hidden = false;
    const traversalTime = document.querySelector("#traversal-time");
    traversalTime.textContent =
      `Estimated traversal time: ${formatNumber(data.traversalTime)} s`;
    traversalTime.hidden = false;
    setStatus("");
  })
  .catch((error) => {
    setStatus(`Visualization could not be loaded: ${error.message}`, true);
  });
