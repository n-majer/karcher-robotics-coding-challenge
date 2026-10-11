#include "data_analysis/robot_data.hpp"

#include <exception>
#include <iostream>
#include <string>

int main(int argc, char* argv[]) {
    if (argc > 2) {
        std::cerr << "Usage: data_analysis [path-to-json]\n";
        return 1;
    }

    const std::string input_path = argc == 2 ? argv[1] : "data/short.json";

    try {
        const data_analysis::RobotData robot_data =
            data_analysis::read_robot_data(input_path);

        std::cout << "Loaded " << robot_data.robot_waypoints.size()
                  << " robot waypoints, " << robot_data.robot_footprint.size()
                  << " robot footprint points, and "
                  << robot_data.cleaning_gadget.size()
                  << " cleaning gadget points.\n";
    } catch (const std::exception& error) {
        std::cerr << "Failed to read '" << input_path << "': " << error.what()
                  << '\n';
        return 1;
    }

    return 0;
}