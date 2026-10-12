#include "path_data_analysis/path_data_analysis.hpp"

#include <algorithm>
#include <exception>
#include <iomanip>
#include <iostream>
#include <numeric>
#include <string>

int main(int argc, char* argv[]) {
    if (argc > 3) {
        std::cerr << "Usage: path_data_analysis [path-to-json] [visualization-json]\n";
        return 1;
    }

    const std::string input_path = argc == 2 ? argv[1] : "data/short.json";
    const std::string output_path =
        argc == 3 ? argv[2] : "results/analysis.json";

    try {
        const data_analysis::RobotData robot_data =
            data_analysis::read_robot_data(input_path);
        data_analysis::write_visualization_data(robot_data, output_path);

        std::cout << "Loaded " << robot_data.robot_waypoints.size()
                  << " robot waypoints, " << robot_data.robot_footprint.size()
                  << " robot footprint points, and "
                  << robot_data.cleaning_gadget.size()
                  << " cleaning gadget points.\n";
        std::cout << std::fixed << std::setprecision(4)
                  << "Path length: " << robot_data.path_length << " m.\n";
        std::cout << std::fixed << std::setprecision(5)
                  << "Cleaned area: " << robot_data.cleaned_area << " m^2.\n";
        std::cout << std::fixed << std::setprecision(3)
                  << "Traversal time: " << robot_data.traversal_time
                  << " s.\n";
    } catch (const std::exception& error) {
        std::cerr << "Failed to read '" << input_path << "': " << error.what()
                  << '\n';
        return 1;
    }

    return 0;
}