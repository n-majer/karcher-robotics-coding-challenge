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

In the initial version, the **path length** is calculated by summing the Euclidean distances between consecutive waypoints of the recorded robot path.

For consecutive waypoints \(p_i=(x_i,y_i)\) and \(p_{i+1}=(x_{i+1},y_{i+1})\), define their coordinate differences as

$$
\Delta x_i = x_{i+1}-x_i,\qquad
\Delta y_i = y_{i+1}-y_i.
$$

The heading estimation of the segment starting at waypoint \(p_i\) is calculated by

$$
\theta_i = \operatorname{atan2}(\Delta y_i,\Delta x_i).
$$

## Assumptions

- I assume that the robot drove with constant heading in a straight line between two consecutive waypoints of the path.
- I assume that the robot heading can be estimated by aligning the base_link x-axis with the straight line between two consecutive waypoints of the path.