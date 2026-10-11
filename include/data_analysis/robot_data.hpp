#pragma once

#include <array>
#include <filesystem>
#include <optional>
#include <vector>

namespace data_analysis {

inline constexpr std::array<double, 3> heading_distance_windows{
    0.01, 0.05, 0.1};

struct Point2D {
    double x;
    double y;
};

struct WaypointDistanceStatistics {
    double minimum;
    double maximum;
    double mean;
};

struct HeadingEstimationVariant {
    double window_distance;
    std::vector<double> headings;
    std::vector<double> distances;
    std::optional<WaypointDistanceStatistics> distance_statistics;
    std::optional<WaypointDistanceStatistics> heading_change_statistics;
};

struct SubsamplingCombination {
    double minimum_waypoint_distance;
    double window_distance;
    std::size_t waypoint_count;
    WaypointDistanceStatistics heading_change_statistics;
};

struct SubsamplingSearch {
    double maximum_allowed_heading_change;
    std::vector<double> candidate_distances;
    std::vector<SubsamplingCombination> qualifying_combinations;
};

struct RobotData {
    std::vector<Point2D> robot_waypoints;
    std::vector<Point2D> robot_footprint;
    std::vector<Point2D> cleaning_gadget;
    double path_length{};
    std::vector<double> headings;
    std::optional<WaypointDistanceStatistics> heading_change_statistics;
    std::vector<HeadingEstimationVariant> adapted_heading_variants;
    std::vector<double> waypoint_distances;
    std::optional<WaypointDistanceStatistics> waypoint_distance_statistics;
    SubsamplingSearch subsampling_search;
};

RobotData read_robot_data(const std::filesystem::path& json_file);
void write_visualization_data(const RobotData& robot_data,
                              const std::filesystem::path& output_file);

}  // namespace data_analysis
