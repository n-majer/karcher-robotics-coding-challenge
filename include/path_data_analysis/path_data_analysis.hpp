#pragma once

#include <cstddef>
#include <filesystem>
#include <iosfwd>
#include <vector>

namespace data_analysis {

// Distances are in metres, speeds in metres per second, and curvatures in 1/m.
inline constexpr double subsampling_distance = 0.01;
inline constexpr double heading_window_distance = 0.03;
inline constexpr double maximum_speed = 1.10;
inline constexpr double minimum_speed = 0.15;
inline constexpr double curvature_critical = 0.5;
inline constexpr double curvature_maximum = 10.0;

// A planar point expressed in the world frame unless otherwise specified.
struct Point2D {
    double x;
    double y;
};

// Filtered waypoints mapped to their original path indices and estimated
// headings.
struct SubsampledHeadingEstimation {
    std::vector<std::size_t> waypoint_indices;
    std::vector<double> headings;
};

// Signed heading change and curvature over a pair or window of path waypoints.
struct CurvatureApproximation {
    std::size_t waypoint_index;
    std::size_t start_waypoint_index;
    std::size_t end_waypoint_index;
    double heading_change;
    double distance;
    double curvature;
};

// Speed assigned to one filtered waypoint from its estimated curvature.
struct WaypointVelocity {
    std::size_t waypoint_index;
    double curvature;
    double speed;
};

// Input geometry, derived metrics, and geometry for downstream visualization.
struct RobotData {
    std::vector<Point2D> robot_waypoints;
    std::vector<Point2D> robot_footprint;
    std::vector<Point2D> cleaning_gadget;
    double path_length{};
    double cleaned_area{};
    // Largest absolute wrap-aware heading change between filtered waypoints,
    // in radians.
    double maximum_heading_change{};
    // Maximum polygonal subcleaned-area relative error, stored as a ratio.
    double maximum_subcleaned_area_relative_error{};
    // Heading estimates and consecutive-waypoint distances for the original
    // path.
    std::vector<double> headings;
    SubsampledHeadingEstimation subsampled_heading_estimation;
    std::vector<CurvatureApproximation> curvature_approximations;
    std::vector<CurvatureApproximation> windowed_curvature_approximations;
    std::vector<WaypointVelocity> waypoint_velocities;
    double traversal_time{};
    // Polygon union as polygons, each containing an outer ring and optional holes.
    std::vector<std::vector<std::vector<Point2D>>> cleaned_area_geometry;
    std::vector<double> waypoint_distances;
};

// Read and analyze JSON with robot, cleaning_gadget, and path arrays of finite
// [x, y] points; cleaning_gadget must contain exactly two segment endpoints.
RobotData read_robot_data(const std::filesystem::path& json_file);
RobotData read_robot_data(std::istream& json_input);

// Write the scalar analysis summary as JSON to a file, creating its parent path.
void write_visualization_data(const RobotData& robot_data,
                              const std::filesystem::path& output_file);

}  // namespace data_analysis
