#pragma once

#include <cstddef>
#include <filesystem>
#include <vector>

namespace data_analysis {

inline constexpr double subsampling_distance = 0.01;
inline constexpr double heading_window_distance = 0.03;
inline constexpr double maximum_speed = 1.10;
inline constexpr double minimum_speed = 0.15;
inline constexpr double curvature_critical = 0.5;
inline constexpr double curvature_maximum = 10.0;

struct Point2D {
    double x;
    double y;
};

struct SubsampledHeadingEstimation {
    std::vector<std::size_t> waypoint_indices;
    std::vector<double> headings;
};

struct CurvatureApproximation {
    std::size_t waypoint_index;
    std::size_t start_waypoint_index;
    std::size_t end_waypoint_index;
    double heading_change;
    double distance;
    double curvature;
};

struct WaypointVelocity {
    std::size_t waypoint_index;
    double curvature;
    double speed;
};

struct RobotData {
    std::vector<Point2D> robot_waypoints;
    std::vector<Point2D> robot_footprint;
    std::vector<Point2D> cleaning_gadget;
    double path_length{};
    double cleaned_area{};
    std::vector<double> headings;
    SubsampledHeadingEstimation subsampled_heading_estimation;
    std::vector<CurvatureApproximation> curvature_approximations;
    std::vector<CurvatureApproximation> windowed_curvature_approximations;
    std::vector<WaypointVelocity> waypoint_velocities;
    double traversal_time{};
    std::vector<std::vector<std::vector<Point2D>>> cleaned_area_geometry;
    std::vector<double> waypoint_distances;
};

RobotData read_robot_data(const std::filesystem::path& json_file);
void write_visualization_data(const RobotData& robot_data,
                              const std::filesystem::path& output_file);

}  // namespace data_analysis
