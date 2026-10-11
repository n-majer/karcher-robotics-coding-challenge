#include "data_analysis/robot_data.hpp"

#include <cmath>
#include <exception>
#include <iomanip>
#include <iostream>
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
        std::cout << "Path length: " << robot_data.path_length << " m.\n"
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
        for (const auto& variant : robot_data.adapted_heading_variants) {
            std::cout << "Heading neighbor distances for "
                      << variant.window_distance << " m window (m):\n";
            if (!variant.distance_statistics) {
                std::cout << "  No heading-estimation distances available.\n";
                continue;
            }
            const auto& statistics = *variant.distance_statistics;
            std::cout << "  Minimum: " << statistics.minimum << '\n'
                      << "  Maximum: " << statistics.maximum << '\n'
                      << "  Mean:    " << statistics.mean << '\n';
        }
        const auto& search = robot_data.subsampling_search;
        std::cout << "Subsampling/window combinations with maximum heading "
                     "change below 30 degrees:\n";
        if (search.qualifying_combinations.empty()) {
            std::cout << "  None found among " << search.candidate_distances.size()
                      << " candidate distances.\n";
        }
        for (const auto& combination : search.qualifying_combinations) {
            std::cout << "  Subsample >= "
                      << combination.minimum_waypoint_distance
                      << " m; heading window >= " << combination.window_distance
                      << " m; " << combination.waypoint_count
                      << " waypoints; maximum change "
                      << combination.heading_change_statistics.maximum *
                             180.0 / std::acos(-1.0)
                      << " degrees.\n";
        }
    } catch (const std::exception& error) {
        std::cerr << "Failed to read '" << input_path << "': " << error.what()
                  << '\n';
        return 1;
    }

    return 0;
}