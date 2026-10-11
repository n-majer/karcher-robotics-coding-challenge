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

function addHoverPoint(svg, plotWrap, point, label, color, radius = 4, bold = false) {
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
    "aria-label": `${label}: (${formatNumber(point.value.x)}, ${formatNumber(point.value.y)})`,
  });
  const content = `${label}: (${formatNumber(point.value.x)}, ${formatNumber(point.value.y)})`;
  circle.addEventListener("pointerenter", (event) =>
    showTooltip(event, tooltip, plotWrap, content),
  );
  circle.addEventListener("pointermove", (event) =>
    showTooltip(event, tooltip, plotWrap, content),
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
      content,
    );
  });
  circle.addEventListener("blur", () => {
    tooltip.hidden = true;
  });
  svg.append(circle);
}

function drawAxes(svg, bounds) {
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
    svgElement("text", { x: WIDTH / 2, y: HEIGHT - 13, "text-anchor": "middle", fill: COLORS.text, "font-size": 13 }, "x"),
    svgElement("text", { x: 22, y: HEIGHT / 2, "text-anchor": "middle", fill: COLORS.text, "font-size": 13, transform: `rotate(-90 22 ${HEIGHT / 2})` }, "y"),
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
  drawAxes(svg, bounds);
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
  drawAxes(svg, bounds);
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

function validateData(data) {
  const keys = ["path", "robot", "cleaning_gadget"];
  for (const key of keys) {
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

fetch("../data/short.json")
  .then((response) => {
    if (!response.ok) throw new Error(`Could not load ../data/short.json (${response.status}).`);
    return response.json();
  })
  .then(validateData)
  .then((data) => {
    renderPath(data.path);
    renderGeometry(data.robot, data.cleaningGadget);
    setStatus("");
  })
  .catch((error) => {
    setStatus(`Visualization could not be loaded: ${error.message}`, true);
  });
