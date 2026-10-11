# Kärcher - Robotics Coding Challenge

This coding challenge focuses on analyzing recorded robot path data to determine the **path length**, **cleaned area** and the **traversal time**.

## Getting Started

### Requirements

- CMake 3.16 or newer
- A C++17 compiler:
  - GCC 9 or newer
  - Clang 10 or newer with a C++17-capable standard library
- Boost 1.65 or newer, including the Boost.PropertyTree headers

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

### Web visualization

The interactive browser visualization is a static page in `visualization/`. Serve the repository root over HTTP so the page can load `data/short.json`:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000/visualization/> in a browser.