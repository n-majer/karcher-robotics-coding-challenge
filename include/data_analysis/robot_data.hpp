#pragma once

#include <filesystem>
#include <vector>

namespace data_analysis {

struct Point2D {
    double x;
    double y;
};

struct RobotData {
    std::vector<Point2D> robot_waypoints;
    std::vector<Point2D> robot_footprint;
    std::vector<Point2D> cleaning_gadget;
};

RobotData read_robot_data(const std::filesystem::path& json_file);

}  // namespace data_analysis
