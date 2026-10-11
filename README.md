# Kärcher - Robotics Coding Challenge

This coding challenge focuses on analyzing recorded robot path data to determine the **path length**, **cleaned area** and the **traversal time**.

## Getting Started

### Requirements

- CMake 3.16 or newer
- A C++17 compiler:
  - GCC 9 or newer
  - Clang 10 or newer with a C++17-capable standard library
- Boost 1.65 or newer

### Install requirements on Ubuntu

Install the compiler toolchain, CMake, and Boost development headers:

```sh
sudo apt update
sudo apt install build-essential cmake libboost-dev
```

### Build and run

From the repository root, configure and build the project:

```sh
cmake -S . -B build
cmake --build build
```

The C++ command-line application can validate and count the sample data:

```sh
./build/data_analysis
```

### Web Visualization

The interactive browser visualization is a static page in `visualization/`. It loads geometry directly from `data/short.json` and the C++-computed metrics from `visualization/analysis.json`. First generate the metrics file with the C++ program, then serve the repository root over HTTP:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000/visualization/> in a browser.

## Approach

In the initial version, the **path length** is calculated by summing the Euclidean distances between two consecutive waypoints of the recorded robot path.

For consecutive waypoints $p_i=(x_i,y_i)$ and $p_{i+1}=(x_{i+1},y_{i+1})$, define their coordinate differences as

$$
\Delta x_i = x_{i+1}-x_i,\qquad
\Delta y_i = y_{i+1}-y_i.
$$

The heading estimation of the segment starting at waypoint $p_i$ is calculated by

$$
\theta_i = \operatorname{atan2}(\Delta y_i,\Delta x_i).
$$

The Euclidean distance between two consecutive waypoints is

$$
\Delta s_i = \sqrt{(x_{i+1}-x_i)^2 + (y_{i+1}-y_i)^2}.
$$

Since the distances between the measured waypoints in the recorded data of the robot path are at the beginning and in the end really small, resulting in great variance in successive heading estimations, the distance between two waypoints before and after the respective waypoint $p_i$ to determine the heading estimation is to be enlarged. The minimum, maximum and mean distances between two consecutive waypoints have been determined:
- minimum distance = 0.000110050 m
- maximum distance = 0.232033 m
- mean distance = 0.0753922 m

The analysis uses a fixed minimum subsampling distance of 0.01 m and a heading window of 0.03 m. It keeps the first waypoint, then retains each following waypoint only when it is at least 0.01 m from the last retained waypoint. The reported path length is summed along this filtered path. Headings are estimated on the filtered path using the 0.03 m window; interior points use symmetric neighbors, endpoints use a one-sided window, and the largest available window is used if the target cannot be reached. The heading plot overlays these filtered-path estimates with the original estimates and aligns them to the original waypoint indices. The visualization shows minimum, maximum, and mean absolute changes between consecutive headings for both series.

The cleaned area is calculated from the filtered path (minimum waypoint spacing 0.01 m) and its 0.03 m-window heading estimates. The two cleaning-gadget segment endpoints are rotated by each filtered waypoint's estimated heading and translated to that waypoint. For each pair of consecutive filtered waypoints, the convex hull of the four transformed endpoints approximates the swept polygon. The reported area is the union of those polygons, so overlapping regions count only once; this union is shaded in the robot path plot.

For each consecutive pair of filtered waypoints, the curvature approximation is the signed, wrap-aware heading change divided by the Euclidean distance between the waypoints: $\kappa_i = \operatorname{atan2}(\sin(\theta_{i+1}-\theta_i),\cos(\theta_{i+1}-\theta_i)) / \Delta s_i$. Values are recorded with both original waypoint indices and plotted against the starting waypoint index in units of inverse meters.

The velocity estimate applies the PDF's piecewise speed model to the magnitude of each signed curvature: $v_{\max}=1.10$ m/s below $|\kappa|=0.5$ 1/m, linearly interpolating down to $v_{\min}=0.15$ m/s at $|\kappa|=10$ 1/m, and remaining at $v_{\min}$ above that. Each segment uses its curvature-derived speed; the first filtered waypoint is assigned the first segment's speed, and each subsequent waypoint is assigned the incoming segment's speed. Estimated traversal time is the sum of each filtered segment distance divided by its speed. This is a curvature-only estimate and does not model acceleration, deceleration, or stops at endpoints.

## Assumptions

- I assume that the robot drove with constant heading in a straight line between two consecutive waypoints of the path.
- I assume that the robot heading can be estimated by aligning the base_link x-axis with the straight line between two consecutive waypoints of the path.
- I assume that each measured waypoint in the world frame corresponds to the origin of the base_link frame of the robot, respectively.