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
  adapted: ["#d07b24", "#168c87", "#b34a9b"],
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

function drawAxes(svg, bounds, xLabel = "x", yLabel = "y") {
  for (let tick = 0; tick <= 5; tick += 1) {
    const fraction = tick / 5;
    const x = PLOT.left + fraction * (WIDTH - PLOT.left - PLOT.right);
    const y = HEIGHT - PLOT.bottom - fraction * (HEIGHT - PLOT.top - PLOT.bottom);
    const xValue = bounds.minX + fraction * (bounds.maxX - bounds.minX);
    const yValue = bounds.minY + fraction * (bounds.maxY - bounds.minY);
    svg.append(
      svgElement("line", { x1: x, y1: PLOT.top, x2: x, y2: HEIGHT - PLOT.bottom, stroke: COLORS.grid }),
      svgElement("line", { x1: PLOT.left, y1: y, x2: WIDTH - PLOT.right, y2: y, stroke: COLORS.grid }),
      svgElement("text", { x, y: HEIGHT - PLOT.bottom + 22, "text-anchor": "middle", fill: COLORS.text, "font-size": 11 }, formatNumber(xValue)),
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
    svg.append(
      svgElement("line", { x1: x, y1: y - 4, x2: x + 20, y2: y - 4, stroke: item.color, "stroke-width": 3 }),
      svgElement("text", { x: x + 26, y, fill: COLORS.text, "font-size": 12 }, item.label),
    );
    x += 38 + item.label.length * 7.2;
  }
}

function drawPath(svg, plotWrap, waypoints, bounds) {
  const pixels = waypoints.map((value) => ({ value, pixel: mapPoint(value, bounds) }));
  if (pixels.length > 1) {
    svg.append(svgElement("polyline", {
      points: pixels.map(({ pixel }) => `${pixel.x},${pixel.y}`).join(" "),
      fill: "none",
      stroke: COLORS.path,
      "stroke-width": 2,
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
    }));
  }
  pixels.forEach((point, index) => {
    addHoverPoint(svg, plotWrap, point, `world waypoint [${index}]`, COLORS.path, 3);
  });
  if (pixels.length > 0) {
    addHoverPoint(svg, plotWrap, pixels[0], "start (world frame)", COLORS.start, 8, true);
    if (pixels.length > 1) {
      addHoverPoint(svg, plotWrap, pixels[pixels.length - 1], "goal (world frame)", COLORS.goal, 8, true);
    }
  }
}

function drawPolygon(svg, plotWrap, points, bounds, label, color, close = false) {
  const pixels = points.map((value) => ({ value, pixel: mapPoint(value, bounds) }));
  if (pixels.length > 1) {
    const sequence = close ? [...pixels, pixels[0]] : pixels;
    svg.append(svgElement("polyline", {
      points: sequence.map(({ pixel }) => `${pixel.x},${pixel.y}`).join(" "),
      fill: "none",
      stroke: color,
      "stroke-width": 3,
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
    }));
  }
  pixels.forEach((point, index) => {
    addHoverPoint(svg, plotWrap, point, `${label} [${index}]`, color, 5);
  });
}

function drawBaseLink(svg, plotWrap, bounds) {
  const origin = { x: 0, y: 0 };
  const pixel = mapPoint(origin, bounds);
  const axisLength = 48;
  const xEnd = { x: pixel.x + axisLength, y: pixel.y };
  const yEnd = { x: pixel.x, y: pixel.y - axisLength };
  svg.append(
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
  addHoverPoint(svg, plotWrap, { value: origin, pixel }, "base_link origin", COLORS.origin, 6, true);
}

function renderPath(waypoints) {
  const svg = document.querySelector("#path-plot");
  const wrap = svg.parentElement;
  const bounds = getBounds([waypoints]);
  drawAxes(svg, bounds, "x (m)", "y (m)");
  svg.append(svgElement("text", { x: 76, y: 28, fill: COLORS.text, "font-size": 15, "font-weight": 700 }, "Robot path · world frame"));
  drawPath(svg, wrap, waypoints, bounds);
  drawLegend(svg, [
    { label: "world-frame path", color: COLORS.path },
    { label: "start", color: COLORS.start },
    { label: "goal", color: COLORS.goal },
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
    { label: "robot footprint", color: COLORS.footprint },
    { label: "cleaning gadget", color: COLORS.gadget },
    { label: "base_link origin", color: COLORS.origin },
  ]);
}

function renderHeadings(headings, adaptedHeadingVariants) {
  const svg = document.querySelector("#heading-plot");
  const wrap = svg.parentElement;
  const series = [
    {
      label: "initial",
      color: COLORS.origin,
      headings,
    },
    ...adaptedHeadingVariants.map((variant, index) => ({
      label: `${variant.windowDistance} m window`,
      color: COLORS.adapted[index % COLORS.adapted.length],
      headings: variant.headings,
    })),
  ].map((item) => ({
    ...item,
    values: item.headings.map((heading, index) => ({ x: index, y: heading })),
  }));
  const bounds = {
    minX: -0.5,
    maxX: Math.max(0.5, headings.length - 0.5),
    minY: -Math.PI,
    maxY: Math.PI,
  };
  drawAxes(svg, bounds, "waypoint index", "heading (rad)");
  svg.append(svgElement("text", { x: 76, y: 28, fill: COLORS.text, "font-size": 15, "font-weight": 700 }, "Heading estimates · world frame"));
  for (const item of series) {
    if (item.values.length < 2) continue;
    svg.append(svgElement("polyline", {
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
        svg,
        wrap,
        { value, pixel },
        `waypoint [${index}] ${item.label}`,
        item.color,
        4,
        false,
        `waypoint [${index}] ${item.label}: ${formatNumber(radians)} rad (${formatNumber(degrees)}°)`,
      );
    });
  }
  drawLegend(svg, series.map(({ label, color }) => ({ label, color })));
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
  const hasHeadingChanges = pathLength > 1;
  const hasValidStatistics = (statistics) =>
    statistics === null
      ? !hasHeadingChanges
      : statistics &&
        typeof statistics === "object" &&
        ["minimum", "maximum", "mean"].every(
          (key) => Number.isFinite(statistics[key]) &&
            statistics[key] >= 0,
        );
  const waypointDistanceStatistics = data.waypoint_distance_statistics;
  const search = data.subsampling_search;
  const validSearch = search &&
    Number.isFinite(search.maximum_allowed_heading_change) &&
    Math.abs(search.maximum_allowed_heading_change - Math.PI / 6) < 1e-12 &&
    Array.isArray(search.candidate_distances) &&
    search.candidate_distances.length <= 10 &&
    search.candidate_distances.every((distance, index, distances) =>
      Number.isFinite(distance) && distance >= 0 &&
      (index === 0 || distance > distances[index - 1]),
    ) &&
    Array.isArray(search.qualifying_combinations) &&
    search.qualifying_combinations.every((combination) =>
      search.candidate_distances.includes(
        combination.minimum_waypoint_distance,
      ) &&
      search.candidate_distances.includes(combination.window_distance) &&
      Number.isInteger(combination.waypoint_count) &&
      combination.waypoint_count >= 2 &&
      combination.waypoint_count <= pathLength &&
      Number.isFinite(combination.maximum_heading_change) &&
      combination.maximum_heading_change >= 0 &&
      combination.maximum_heading_change <
        search.maximum_allowed_heading_change &&
      Number.isFinite(combination.mean_heading_change) &&
      combination.mean_heading_change >= 0,
    );
  if (!Number.isFinite(data.path_length) ||
      !Array.isArray(data.headings) ||
      data.headings.length !== pathLength ||
      !data.headings.every(Number.isFinite) ||
      !waypointDistanceStatistics ||
      !["minimum", "maximum", "mean"].every(
        (key) => Number.isFinite(waypointDistanceStatistics[key]) &&
          waypointDistanceStatistics[key] >= 0,
      ) ||
      !hasValidStatistics(data.heading_change_statistics) ||
      !validSearch ||
      !Array.isArray(data.adapted_heading_variants) ||
      data.adapted_heading_variants.length !== 3 ||
      !data.adapted_heading_variants.every((variant, index) =>
        Number.isFinite(variant.window_distance) &&
        variant.window_distance === [0.01, 0.05, 0.1][index] &&
        Array.isArray(variant.headings) &&
        variant.headings.length === pathLength &&
        variant.headings.every(Number.isFinite) &&
        hasValidStatistics(variant.heading_change_statistics),
      )) {
    throw new Error("Invalid or missing C++-computed path length or headings.");
  }
  return {
    pathLength: data.path_length,
    headings: data.headings,
    waypointDistanceStatistics,
    subsamplingSearch: search,
    headingChangeStatistics: data.heading_change_statistics,
    adaptedHeadingVariants: data.adapted_heading_variants.map((variant) => ({
      windowDistance: variant.window_distance,
      headings: variant.headings,
      headingChangeStatistics: variant.heading_change_statistics,
    })),
  };
}

function renderHeadingChangeStatistics(statistics, variants) {
  const section = document.querySelector("#heading-change-summary");
  const rows = [
    {
      label: "Original headings",
      statistics,
    },
    ...variants.map((variant) => ({
      label: `${variant.windowDistance} m window`,
      statistics: variant.headingChangeStatistics,
    })),
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

function renderSubsamplingSearch(search) {
  const section = document.querySelector("#subsampling-search-summary");
  const body = section.querySelector("tbody");
  if (search.qualifying_combinations.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.textContent = "No qualifying combinations found.";
    row.append(cell);
    body.append(row);
  } else {
    for (const combination of search.qualifying_combinations) {
      const row = document.createElement("tr");
      for (const value of [
        `${combination.minimum_waypoint_distance.toPrecision(6)} m`,
        `${combination.window_distance.toPrecision(6)} m`,
        combination.waypoint_count,
        `${(combination.maximum_heading_change * 180 / Math.PI).toPrecision(6)}°`,
      ]) {
        const cell = document.createElement("td");
        cell.textContent = String(value);
        row.append(cell);
      }
      body.append(row);
    }
  }
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
    renderPath(data.path);
    renderGeometry(data.robot, data.cleaningGadget);
    renderHeadings(data.headings, data.adaptedHeadingVariants);
    renderHeadingChangeStatistics(
      data.headingChangeStatistics,
      data.adaptedHeadingVariants,
    );
    renderWaypointDistanceStatistics(data.waypointDistanceStatistics);
    renderSubsamplingSearch(data.subsamplingSearch);
    const pathLength = document.querySelector("#path-length");
    pathLength.textContent = `Path length: ${formatNumber(data.pathLength)} m`;
    pathLength.hidden = false;
    setStatus("");
  })
  .catch((error) => {
    setStatus(`Visualization could not be loaded: ${error.message}`, true);
  });
