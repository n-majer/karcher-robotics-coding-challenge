#include "data_analysis/robot_data.hpp"

#include <exception>
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
        std::cout << "Path length: " << robot_data.path_length_m << " m.\n"
                  << "Saved precomputed visualization data to " << output_path
                  << ".\n";
    } catch (const std::exception& error) {
        std::cerr << "Failed to read '" << input_path << "': " << error.what()
                  << '\n';
        return 1;
    }

    return 0;
}