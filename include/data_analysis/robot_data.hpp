#pragma once

#include <cstddef>
#include <filesystem>
#include <optional>
#include <vector>

namespace data_analysis {

inline constexpr double subsampling_distance = 0.01;
inline constexpr double heading_window_distance = 0.03;

struct Point2D {
    double x;
    double y;
};

struct WaypointDistanceStatistics {
    double minimum;
    double maximum;
    double mean;
};

struct SubsampledHeadingEstimation {
    std::vector<std::size_t> waypoint_indices;
    std::vector<double> headings;
    std::optional<WaypointDistanceStatistics> heading_change_statistics;
};

struct CurvatureApproximation {
    std::size_t start_waypoint_index;
    std::size_t end_waypoint_index;
    double heading_change;
    double distance;
    double curvature;
};

struct RobotData {
    std::vector<Point2D> robot_waypoints;
    std::vector<Point2D> robot_footprint;
    std::vector<Point2D> cleaning_gadget;
    double path_length{};
    double cleaned_area{};
    std::vector<double> headings;
    std::optional<WaypointDistanceStatistics> heading_change_statistics;
    SubsampledHeadingEstimation subsampled_heading_estimation;
    std::vector<CurvatureApproximation> curvature_approximations;
    std::vector<std::vector<std::vector<Point2D>>> cleaned_area_geometry;
    std::vector<double> waypoint_distances;
    std::optional<WaypointDistanceStatistics> waypoint_distance_statistics;
};

RobotData read_robot_data(const std::filesystem::path& json_file);
void write_visualization_data(const RobotData& robot_data,
                              const std::filesystem::path& output_file);

}  // namespace data_analysis
