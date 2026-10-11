#include "data_analysis/robot_data.hpp"

#include <algorithm>
#include <exception>
#include <iomanip>
#include <iostream>
#include <numeric>
#include <string>

int main(int argc, char* argv[]) {
    if (argc > 3) {
        std::cerr << "Usage: data_analysis [path-to-json] [visualization-json]\n";
        return 1;
    }

    const std::string input_path = argc == 2 ? argv[1] : "data/short.json";
    const std::string output_path =
        argc == 3 ? argv[2] : "visualization/analysis.json";

    try {
        const data_analysis::RobotData robot_data =
            data_analysis::read_robot_data(input_path);
        data_analysis::write_visualization_data(robot_data, output_path);

        std::cout << "Loaded " << robot_data.robot_waypoints.size()
                  << " robot waypoints, " << robot_data.robot_footprint.size()
                  << " robot footprint points, and "
                  << robot_data.cleaning_gadget.size()
                  << " cleaning gadget points.\n";
        std::cout << "Filtered path length: " << robot_data.path_length
                  << " m.\n"
                  << "Calculated cleaned area: " << robot_data.cleaned_area
                  << " m^2.\n"
                  << "Estimated traversal time: " << robot_data.traversal_time
                  << " s.\n"
                  << "Saved precomputed visualization data to " << output_path
                  << ".\n";

        if (!robot_data.waypoint_distance_statistics) {
            std::cout << "No heading-estimation distances available.\n";
        } else {
            const auto& statistics = *robot_data.waypoint_distance_statistics;
            std::cout << std::setprecision(6)
                      << "Consecutive waypoint distances (m):\n"
                      << "  Minimum: " << statistics.minimum << '\n'
                      << "  Maximum: " << statistics.maximum << '\n'
                      << "  Mean:    " << statistics.mean << '\n';
        }
        std::cout << std::setprecision(6);
        const auto& estimate = robot_data.subsampled_heading_estimation;
        std::cout << "Subsampled heading estimate (minimum waypoint distance "
                  << data_analysis::subsampling_distance
                  << " m, heading window "
                  << data_analysis::heading_window_distance << " m):\n"
                  << "  Retained waypoints: " << estimate.waypoint_indices.size()
                  << '\n';
        if (estimate.heading_change_statistics) {
            const auto& statistics = *estimate.heading_change_statistics;
            std::cout << "  Heading change min/max/mean (rad): "
                      << statistics.minimum << " / " << statistics.maximum
                      << " / " << statistics.mean << '\n';
        }
        std::cout << "Curvature approximations: "
                  << robot_data.curvature_approximations.size()
                  << " filtered path segments (signed, 1/m).\n";
        if (!robot_data.curvature_approximations.empty()) {
            const auto [minimum, maximum] = std::minmax_element(
                robot_data.curvature_approximations.begin(),
                robot_data.curvature_approximations.end(),
                [](const auto& left, const auto& right) {
                    return left.curvature < right.curvature;
                });
            const double mean = std::accumulate(
                                    robot_data.curvature_approximations.begin(),
                                    robot_data.curvature_approximations.end(),
                                    0.0,
                                    [](double total, const auto& value) {
                                        return total + value.curvature;
                                    }) /
                                static_cast<double>(
                                    robot_data.curvature_approximations.size());
            std::cout << "  Minimum: " << minimum->curvature << '\n'
                      << "  Maximum: " << maximum->curvature << '\n'
                      << "  Mean:    " << mean << '\n';
        }
        std::cout << "Windowed curvature approximations (0.03 m, 1/m): "
                  << robot_data.windowed_curvature_approximations.size()
                  << " filtered waypoints.\n";
        if (!robot_data.windowed_curvature_approximations.empty()) {
            const auto [minimum, maximum] = std::minmax_element(
                robot_data.windowed_curvature_approximations.begin(),
                robot_data.windowed_curvature_approximations.end(),
                [](const auto& left, const auto& right) {
                    return left.curvature < right.curvature;
                });
            const double mean = std::accumulate(
                                    robot_data.windowed_curvature_approximations.begin(),
                                    robot_data.windowed_curvature_approximations.end(),
                                    0.0,
                                    [](double total, const auto& value) {
                                        return total + value.curvature;
                                    }) /
                                static_cast<double>(robot_data.windowed_curvature_approximations.size());
            std::cout << "  Windowed curvature min/max/mean: "
                      << minimum->curvature << " / " << maximum->curvature
                      << " / " << mean << '\n';
        }
        std::cout << "Waypoint velocity estimates: "
                  << robot_data.waypoint_velocities.size()
                  << " filtered waypoints.\n";
    } catch (const std::exception& error) {
        std::cerr << "Failed to read '" << input_path << "': " << error.what()
                  << '\n';
        return 1;
    }

    return 0;
}