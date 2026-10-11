# Kärcher - Robotics Coding Challenge

This coding challenge focuses on analyzing recorded robot path data to determine the **path length**, **cleaned area** and the **traversal time**.

## Getting Started

### Requirements

- CMake 3.16 or newer
- A C++17 compiler with `std::filesystem` support:
  - GCC 9 or newer
  - Clang 10 or newer with a C++17-capable standard library
  - MSVC 2019 or newer
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

Run the command-line application from the repository root so its default input path, `data/short.json`, resolves correctly:

```sh
./build/data_analysis
```
