#include "path_data_analysis/path_data_analysis.hpp"

#include <cmath>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>

namespace {

void require(bool condition, const std::string& message) {
    if (!condition) {
        throw std::runtime_error(message);
    }
}

bool nearly_equal(double actual, double expected) {
    return std::abs(actual - expected) <= 1e-9;
}

data_analysis::RobotData read_data(const std::string& path) {
    std::istringstream input(
        R"({"robot":[[-0.4,-0.37],[-0.4,0.37],[0.7,0.37],[0.7,-0.37]],"cleaning_gadget":[[0,0.5],[0,-0.5]],"path":)" +
        path + "}");
    return data_analysis::read_robot_data(input);
}

void test_empty_path() {
    const auto data = read_data("[]");
    require(nearly_equal(data.path_length, 0.0),
            "Empty path length should be zero");
    require(nearly_equal(data.cleaned_area, 0.0),
            "Empty path cleaned area should be zero");
    require(nearly_equal(data.traversal_time, 0.0),
            "Empty path traversal time should be zero");
    require(data.headings.empty() && data.waypoint_velocities.empty() &&
                data.cleaned_area_geometry.empty(),
            "Empty path should not produce headings, velocities, or area geometry");
}

void test_single_waypoint() {
    const auto data = read_data("[[0,0]]");
    require(nearly_equal(data.path_length, 0.0),
            "Single-waypoint path length should be zero");
    require(nearly_equal(data.cleaned_area, 0.0),
            "Single-waypoint path cleaned area should be zero");
    require(nearly_equal(data.traversal_time, 0.0),
            "Single-waypoint traversal time should be zero");
    require(data.headings.size() == 1 && data.headings.front() == 0.0,
            "Single waypoint should receive a zero heading");
    require(data.waypoint_velocities.empty(),
            "Single waypoint should not produce velocity estimates");
}

}  // namespace

int main() {
    try {
        test_empty_path();
        test_single_waypoint();
        std::cout << "Edge path tests passed\n";
        return 0;
    } catch (const std::exception& error) {
        std::cerr << "Edge path test failed: " << error.what() << '\n';
        return 1;
    }
}
