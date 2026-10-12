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
  const firstY = HEIGHT + 18;
  const maximumX = WIDTH - PLOT.right;
  let x = PLOT.left + 4;
  let row = 0;
  for (const item of items) {
    const itemWidth = 38 + item.label.length * 7.2;
    if (x + itemWidth > maximumX && x > PLOT.left + 4) {
      row += 1;
      x = PLOT.left + 4;
    }
    const y = firstY + row * 20;
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
      const targets = item.targets ?? [item.target];
      const series = targets
        .map((target) => svg.querySelector(`[data-series="${target}"]`))
        .filter(Boolean);
      const shouldHide = series.some((element) => element.getAttribute("display") !== "none");
      for (const element of series) {
        if (shouldHide) {
          element.setAttribute("display", "none");
        } else {
          element.removeAttribute("display");
        }
      }
      entry.setAttribute("aria-pressed", String(!shouldHide));
      entry.classList.toggle("is-hidden", shouldHide);
    };
    entry.addEventListener("click", toggleSeries);
    entry.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleSeries();
      }
    });
    svg.append(entry);
    x += itemWidth;
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
      "fill-rule": "nonzero",
      "pointer-events": "none",
      "aria-label": "Cleaned area",
    }));
  }
}

function velocityColor(speed, minimum, maximum) {
  const fraction = maximum === minimum
    ? 0.5
    : Math.max(0, Math.min(1, (speed - minimum) / (maximum - minimum)));
  const stops = [
    { position: 0, color: [49, 54, 149] },
    { position: 0.5, color: [255, 255, 191] },
    { position: 1, color: [165, 0, 38] },
  ];
  const upperIndex = stops.findIndex((stop) => stop.position >= fraction);
  const lower = stops[Math.max(0, upperIndex - 1)];
  const upper = stops[Math.max(0, upperIndex)];
  const localFraction = upper.position === lower.position
    ? 0
    : (fraction - lower.position) / (upper.position - lower.position);
  const channels = lower.color.map((channel, index) =>
    Math.round(channel + (upper.color[index] - channel) * localFraction),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function renderVelocityPath(svg, filteredWaypoints, waypointVelocities, bounds) {
  if (filteredWaypoints.length !== waypointVelocities.length ||
      filteredWaypoints.length < 2) {
    return;
  }
  const speeds = waypointVelocities.map((velocity) => velocity.speed);
  const minimum = Math.min(...speeds);
  const maximum = Math.max(...speeds);
  const group = createSeriesGroup(svg, "velocity-path");
  for (let index = 0; index < filteredWaypoints.length - 1; index += 1) {
    const start = mapPoint(filteredWaypoints[index], bounds);
    const end = mapPoint(filteredWaypoints[index + 1], bounds);
    const speed = (speeds[index] + speeds[index + 1]) / 2;
    group.append(svgElement("line", {
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      stroke: velocityColor(speed, minimum, maximum),
      "stroke-width": 4,
      "stroke-linecap": "round",
      "aria-label": `Path segment velocity: ${formatNumber(speed)} m/s`,
    }));
  }
}

function renderVelocityScale(svg, waypointVelocities) {
  if (waypointVelocities.length === 0) return;
  const speeds = waypointVelocities.map((velocity) => velocity.speed);
  const minimum = Math.min(...speeds);
  const maximum = Math.max(...speeds);
  const defs = svgElement("defs");
  const gradient = svgElement("linearGradient", {
    id: "path-velocity-gradient",
    x1: "0%",
    x2: "100%",
    y1: "0%",
    y2: "0%",
  });
  gradient.append(
    svgElement("stop", { offset: "0%", "stop-color": velocityColor(minimum, minimum, maximum) }),
    svgElement("stop", { offset: "50%", "stop-color": velocityColor((minimum + maximum) / 2, minimum, maximum) }),
    svgElement("stop", { offset: "100%", "stop-color": velocityColor(maximum, minimum, maximum) }),
  );
  defs.append(gradient);
  svg.prepend(defs);
  const scaleX = 390;
  const scaleWidth = 280;
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, index) => {
    const fraction = index / (tickCount - 1);
    const speed = minimum + fraction * (maximum - minimum);
    const x = scaleX + fraction * scaleWidth;
    return [
      svgElement("line", {
        x1: x,
        y1: 40,
        x2: x,
        y2: 46,
        stroke: COLORS.text,
        "stroke-width": 1,
      }),
      svgElement("text", {
        x,
        y: 51,
        fill: COLORS.text,
        "font-size": 10,
        "text-anchor": index === 0 ? "start" : index === tickCount - 1 ? "end" : "middle",
      }, formatNumber(speed)),
    ];
  }).flat();
  const scale = createSeriesGroup(svg, "velocity-scale");
  scale.append(
    svgElement("text", { x: scaleX, y: 15, fill: COLORS.text, "font-size": 12, "font-weight": 650 }, "Velocity (m/s)"),
    svgElement("rect", { x: scaleX, y: 20, width: scaleWidth, height: 18, rx: 5, fill: "url(#path-velocity-gradient)" }),
    ...ticks,
  );
}

function transformPosePoint(waypoint, point, heading) {
  const cosine = Math.cos(heading);
  const sine = Math.sin(heading);
  return {
    x: waypoint.x + point.x * cosine - point.y * sine,
    y: waypoint.y + point.x * sine + point.y * cosine,
  };
}

function renderHeadingArrows(svg, waypoints, headings, bounds) {
  const group = createSeriesGroup(svg, "heading-arrows");
  const markerId = "path-heading-arrow";
  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = svgElement("defs");
    svg.prepend(defs);
  }
  const marker = svgElement("marker", {
    id: markerId,
    markerWidth: 7,
    markerHeight: 7,
    refX: 6,
    refY: 3,
    orient: "auto",
    markerUnits: "strokeWidth",
  });
  marker.append(svgElement("path", {
    d: "M0,0 L0,5 L6,2.5 z",
    fill: "#202b36",
  }));
  defs.append(marker);

  for (let index = 0; index < waypoints.length; index += 5) {
    const start = mapPoint(waypoints[index], bounds);
    const end = mapPoint(
      transformPosePoint(waypoints[index], { x: 0.65, y: 0 }, headings[index]),
      bounds,
    );
    const line = svgElement("line", {
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      stroke: "#202b36",
      "stroke-width": 1.2,
      "marker-end": `url(#${markerId})`,
      "aria-label": `Heading at filtered waypoint ${index}`,
    });
    line.append(svgElement("title", {}, `Heading at filtered waypoint ${index}`));
    group.append(line);
  }
}

function renderRobotPoses(svg, waypoints, headings, robot, gadget, bounds) {
  const robotGroup = createSeriesGroup(svg, "robot-poses");
  const gadgetGroup = createSeriesGroup(svg, "gadget-poses");
  for (let index = 0; index < waypoints.length; index += 10) {
    const robotPixels = robot.map((point) =>
      mapPoint(transformPosePoint(waypoints[index], point, headings[index]), bounds),
    );
    const robotPolygon = svgElement("polygon", {
      points: robotPixels.map(({ x, y }) => `${x},${y}`).join(" "),
      fill: COLORS.footprint,
      "fill-opacity": 0.18,
      stroke: COLORS.footprint,
      "stroke-width": 1.5,
      "aria-label": `Robot footprint at filtered waypoint ${index}`,
    });
    robotPolygon.append(svgElement("title", {}, `Robot footprint at filtered waypoint ${index}`));
    robotGroup.append(robotPolygon);

    const gadgetPixels = gadget.map((point) =>
      mapPoint(transformPosePoint(waypoints[index], point, headings[index]), bounds),
    );
    const gadgetLine = svgElement("line", {
      x1: gadgetPixels[0].x,
      y1: gadgetPixels[0].y,
      x2: gadgetPixels[1].x,
      y2: gadgetPixels[1].y,
      stroke: COLORS.gadget,
      "stroke-width": 3,
      "stroke-linecap": "round",
      "aria-label": `Cleaning gadget at filtered waypoint ${index}`,
    });
    gadgetLine.append(svgElement("title", {}, `Cleaning gadget at filtered waypoint ${index}`));
    gadgetGroup.append(gadgetLine);
  }
}

function renderPath(
  waypoints,
  subsampledWaypointIndices,
  cleanedAreaGeometry,
  waypointVelocities,
  subsampledHeadings,
  robot,
  gadget,
) {
  const svg = document.querySelector("#path-plot");
  const wrap = svg.parentElement;
  const filteredWaypoints = subsampledWaypointIndices.map((index) => waypoints[index]);
  const posePoints = [];
  for (let index = 0; index < filteredWaypoints.length; index += 10) {
    posePoints.push(
      ...robot.map((point) =>
        transformPosePoint(filteredWaypoints[index], point, subsampledHeadings[index]),
      ),
      ...gadget.map((point) =>
        transformPosePoint(filteredWaypoints[index], point, subsampledHeadings[index]),
      ),
    );
  }
  const cleanedAreaPoints = cleanedAreaGeometry.flat(2);
  const bounds = getBounds([waypoints, cleanedAreaPoints, posePoints], true);
  drawAxes(svg, bounds, "x (m)", "y (m)");
  svg.append(svgElement("text", { x: 76, y: 28, fill: COLORS.text, "font-size": 15, "font-weight": 700 }));
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
  drawPathSeries(
    svg,
    wrap,
    filteredWaypoints,
    bounds,
    "filtered-path",
    "Filtered path",
    COLORS.adapted,
    subsampledWaypointIndices,
  );
  renderVelocityPath(
    svg,
    filteredWaypoints,
    waypointVelocities,
    bounds,
  );
  renderVelocityScale(svg, waypointVelocities);
  renderHeadingArrows(svg, filteredWaypoints, subsampledHeadings, bounds);
  renderRobotPoses(
    svg,
    filteredWaypoints,
    subsampledHeadings,
    robot,
    gadget,
    bounds,
  );
  drawLegend(svg, [
    { label: "Recorded path", color: COLORS.path, target: "original-path" },
    { label: "Filtered path", color: COLORS.adapted, target: "filtered-path" },
    { label: "Cleaned area", color: "#267653", target: "cleaned-area" },
    {
      label: "Speed",
      color: "url(#path-velocity-gradient)",
      targets: ["velocity-path", "velocity-scale"],
    },
    { label: "Heading", color: "#202b36", target: "heading-arrows" },
    { label: "Robot", color: COLORS.footprint, target: "robot-poses" },
    { label: "Cleaning gadget", color: COLORS.gadget, target: "gadget-poses" },
  ]);
}

function pointDistance(left, right) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function estimateHeadings(waypoints, windowDistance) {
  return waypoints.map((_, index) => {
    if (waypoints.length < 2) return 0;

    let leftIndex = index;
    let rightIndex = index;
    if (index === 0) {
      rightIndex = 1;
      while (rightIndex + 1 < waypoints.length &&
             pointDistance(waypoints[index], waypoints[rightIndex]) < windowDistance) {
        rightIndex += 1;
      }
    } else if (index === waypoints.length - 1) {
      leftIndex = index - 1;
      while (leftIndex > 0 &&
             pointDistance(waypoints[leftIndex], waypoints[index]) < windowDistance) {
        leftIndex -= 1;
      }
    } else {
      const maximumOffset = Math.min(index, waypoints.length - 1 - index);
      let offset = 1;
      for (; offset < maximumOffset; offset += 1) {
        if (pointDistance(waypoints[index - offset], waypoints[index + offset]) >= windowDistance) {
          break;
        }
      }
      leftIndex = index - offset;
      rightIndex = index + offset;
    }

    return Math.atan2(
      waypoints[rightIndex].y - waypoints[leftIndex].y,
      waypoints[rightIndex].x - waypoints[leftIndex].x,
    );
  });
}

function estimateWindowedCurvature(waypoints, headings, index, windowDistance) {
  let leftIndex = index;
  let rightIndex = index;
  if (index === 0) {
    rightIndex = index + 1;
    while (rightIndex + 1 < waypoints.length &&
           pointDistance(waypoints[index], waypoints[rightIndex]) < windowDistance) {
      rightIndex += 1;
    }
  } else if (index === waypoints.length - 1) {
    leftIndex = index - 1;
    while (leftIndex > 0 &&
           pointDistance(waypoints[leftIndex], waypoints[index]) < windowDistance) {
      leftIndex -= 1;
    }
  } else {
    const maximumOffset = Math.min(index, waypoints.length - 1 - index);
    let offset = 1;
    for (; offset < maximumOffset; offset += 1) {
      if (pointDistance(waypoints[index - offset], waypoints[index + offset]) >= windowDistance) {
        break;
      }
    }
    leftIndex = index - offset;
    rightIndex = index + offset;
  }

  const headingChange = headings[rightIndex] - headings[leftIndex];
  const wrappedHeadingChange = Math.atan2(
    Math.sin(headingChange),
    Math.cos(headingChange),
  );
  return wrappedHeadingChange /
    pointDistance(waypoints[leftIndex], waypoints[rightIndex]);
}

function speedForCurvature(curvature) {
  const magnitude = Math.abs(curvature);
  if (magnitude < 0.5) return 1.1;
  if (magnitude >= 10) return 0.15;
  return 1.1 - ((1.1 - 0.15) / (10 - 0.5)) * (magnitude - 0.5);
}

function convexHull(points) {
  const sorted = [...points].sort((left, right) =>
    left.x - right.x || left.y - right.y,
  );
  const cross = (origin, left, right) =>
    (left.x - origin.x) * (right.y - origin.y) -
    (left.y - origin.y) * (right.x - origin.x);
  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2 &&
           cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }
  const upper = [];
  for (const point of [...sorted].reverse()) {
    while (upper.length >= 2 &&
           cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function createPathLayers(waypoints, gadget) {
  const waypointIndices = [];
  if (waypoints.length > 0) waypointIndices.push(0);
  for (let index = 1; index < waypoints.length; index += 1) {
    const lastRetained = waypoints[waypointIndices[waypointIndices.length - 1]];
    if (pointDistance(lastRetained, waypoints[index]) >= 0.01) {
      waypointIndices.push(index);
    }
  }

  const filteredWaypoints = waypointIndices.map((index) => waypoints[index]);
  const headings = estimateHeadings(filteredWaypoints, 0.03);
  const waypointVelocities = filteredWaypoints.length < 2
    ? []
    : filteredWaypoints.map((_, index) => ({
      speed: speedForCurvature(
        estimateWindowedCurvature(filteredWaypoints, headings, index, 0.03),
      ),
    }));
  const cleanedAreaGeometry = [];
  if (gadget.length === 2) {
    for (let index = 1; index < filteredWaypoints.length; index += 1) {
      const corners = [
        transformPosePoint(filteredWaypoints[index - 1], gadget[0], headings[index - 1]),
        transformPosePoint(filteredWaypoints[index], gadget[0], headings[index]),
        transformPosePoint(filteredWaypoints[index], gadget[1], headings[index]),
        transformPosePoint(filteredWaypoints[index - 1], gadget[1], headings[index - 1]),
      ];
      cleanedAreaGeometry.push([convexHull(corners)]);
    }
  }

  return {
    waypointIndices,
    headings,
    waypointVelocities,
    cleanedAreaGeometry,
  };
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

function renderCurvature(approximations, windowedApproximations) {
  const svg = document.querySelector("#curvature-plot");
  const series = [
    {
      key: "curvature",
      label: "Consecutive-point curvature",
      color: COLORS.origin,
      approximations,
    },
    {
      key: "windowed-curvature",
      label: "0.03 m window curvature",
      color: COLORS.adapted,
      approximations: windowedApproximations,
    },
  ].map((item) => ({
    ...item,
    values: item.approximations.map((approximation) => ({
      x: approximation.waypointIndex,
      y: approximation.curvature,
    })),
  }));
  const allValues = series.flatMap((item) => item.values);
  const minX = allValues.length
    ? Math.min(...allValues.map(({ x }) => x))
    : 0;
  const maxX = allValues.length
    ? Math.max(...allValues.map(({ x }) => x))
    : 1;
  let minY = allValues.length
    ? Math.min(...allValues.map(({ y }) => y))
    : -1;
  let maxY = allValues.length
    ? Math.max(...allValues.map(({ y }) => y))
    : 1;
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
    "waypoint index",
    "curvature (1/m)",
    (value) => String(Math.max(minX, Math.min(maxX, Math.round(value)))),
  );
  svg.append(svgElement(
    "text",
    { x: 76, y: 28, fill: COLORS.text, "font-size": 15, "font-weight": 700 },
    "Curvature approximations",
  ));
  for (const item of series) {
    const group = createSeriesGroup(svg, item.key);
    if (item.values.length > 1) {
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
    item.values.forEach((value, index) => {
      const approximation = item.approximations[index];
      const pixel = mapPoint(value, bounds);
      addHoverPoint(
        group,
        svg.parentElement,
        { value, pixel },
        `waypoints ${approximation.startWaypointIndex}–${approximation.endWaypointIndex}`,
        item.color,
        4,
        false,
        `waypoints ${approximation.startWaypointIndex}–${approximation.endWaypointIndex}: ` +
          `${approximation.curvature.toPrecision(6)} 1/m ` +
          `(Δθ ${approximation.headingChange.toPrecision(6)} rad, ` +
          `Δs ${approximation.distance.toPrecision(6)} m)`,
      );
    });
  }
  drawLegend(svg, series.map(({ key, label, color }) => ({
    label,
    color,
    target: key,
  })));
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

function validateSummaryData(data) {
  if (!Number.isFinite(data.path_length) ||
      !Number.isFinite(data.cleaned_area) ||
      data.cleaned_area < 0 ||
      !Number.isFinite(data.traversal_time) ||
      data.traversal_time < 0) {
    throw new Error("Invalid or missing C++-computed path summary data.");
  }
  return {
    pathLength: data.path_length,
    cleanedArea: data.cleaned_area,
    traversalTime: data.traversal_time,
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
  const windowedCurvatureApproximations =
    data.windowed_curvature_approximations;
  const filteredWaypointIndices =
    subsampledEstimation?.waypoint_indices ?? [];
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
      approximation.waypoint_index ===
        subsampledEstimation.waypoint_indices[index] &&
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
  const validWindowedCurvatureApproximations =
    Array.isArray(windowedCurvatureApproximations) &&
    windowedCurvatureApproximations.length ===
      (subsampledEstimation?.waypoint_indices?.length >= 2
          ? subsampledEstimation.waypoint_indices.length
          : 0) &&
    windowedCurvatureApproximations.every((approximation, index, values) =>
      approximation.waypoint_index ===
          subsampledEstimation.waypoint_indices[index] &&
      Number.isInteger(approximation.start_waypoint_index) &&
      Number.isInteger(approximation.end_waypoint_index) &&
      approximation.start_waypoint_index <= approximation.waypoint_index &&
      approximation.end_waypoint_index >= approximation.waypoint_index &&
      approximation.start_waypoint_index >=
          subsampledEstimation.waypoint_indices[0] &&
      approximation.end_waypoint_index <=
          subsampledEstimation.waypoint_indices[
            subsampledEstimation.waypoint_indices.length - 1
          ] &&
      Number.isFinite(approximation.heading_change) &&
      approximation.heading_change >= -Math.PI &&
      approximation.heading_change <= Math.PI &&
      Number.isFinite(approximation.distance) &&
      approximation.distance > 0 &&
      (approximation.distance >= 0.03 - 1e-12 ||
        approximation.start_waypoint_index === filteredWaypointIndices[0] ||
        approximation.end_waypoint_index ===
          filteredWaypointIndices[filteredWaypointIndices.length - 1]) &&
      Number.isFinite(approximation.curvature) &&
      Math.abs(
          approximation.curvature -
            approximation.heading_change / approximation.distance,
      ) < 1e-9 &&
      (index === 0 ||
          approximation.waypoint_index > values[index - 1].waypoint_index),
    );
  const validWaypointVelocities =
    Array.isArray(waypointVelocities) &&
    waypointVelocities.length ===
      windowedCurvatureApproximations?.length &&
    waypointVelocities.every((velocity, index) => {
      const curvature = windowedCurvatureApproximations[index]?.curvature;
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
      !validWindowedCurvatureApproximations ||
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
      waypointIndex: item.waypoint_index,
      startWaypointIndex: item.start_waypoint_index,
      endWaypointIndex: item.end_waypoint_index,
      headingChange: item.heading_change,
      distance: item.distance,
      curvature: item.curvature,
    })),
    windowedCurvatureApproximations:
      windowedCurvatureApproximations.map((item) => ({
        waypointIndex: item.waypoint_index,
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
  fetch("../results/analysis.json").then((response) => {
    if (!response.ok) {
      throw new Error(`Could not load ../results/analysis.json (${response.status}). Run the C++ path_data_analysis program first.`);
    }
    return response.json();
  }),
])
  .then((response) => {
    const [pointData, analysisData] = response;
    return {
      ...pointData,
      ...validateSummaryData(analysisData),
    };
  })
  .then((data) => {
    const pathLayers = createPathLayers(data.path, data.cleaningGadget);
    renderPath(
      data.path,
      pathLayers.waypointIndices,
      pathLayers.cleanedAreaGeometry,
      pathLayers.waypointVelocities,
      pathLayers.headings,
      data.robot,
      data.cleaningGadget,
    );
    const pathLength = document.querySelector("#path-length");
    pathLength.textContent =
      `Path length: ${formatNumber(data.pathLength)} m`;
    pathLength.hidden = false;
    const cleanedArea = document.querySelector("#cleaned-area");
    cleanedArea.textContent =
      `Cleaned area: ${formatNumber(data.cleanedArea)} m²`;
    cleanedArea.hidden = false;
    const traversalTime = document.querySelector("#traversal-time");
    traversalTime.textContent =
      `Traversal time: ${formatNumber(data.traversalTime)} s`;
    traversalTime.hidden = false;
    setStatus("");
  })
  .catch((error) => {
    setStatus(`Visualization could not be loaded: ${error.message}`, true);
  });