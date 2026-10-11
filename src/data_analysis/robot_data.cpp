#include "data_analysis/robot_data.hpp"

#include <cmath>
#include <fstream>
#include <initializer_list>
#include <iomanip>
#include <limits>
#include <stdexcept>
#include <string>

#include <boost/lexical_cast.hpp>
#include <boost/property_tree/json_parser.hpp>
#include <boost/property_tree/ptree.hpp>

namespace data_analysis {
namespace {

double read_coordinate(const boost::property_tree::ptree& value,
                       const std::string& key,
                       std::size_t point_index) {
    double coordinate;
    try {
        coordinate = boost::lexical_cast<double>(value.data());
    } catch (const boost::bad_lexical_cast&) {
        throw std::runtime_error("JSON field '" + key + "' point " +
                                 std::to_string(point_index) +
                                 " must contain numeric coordinates");
    }
    if (!std::isfinite(coordinate)) {
        throw std::runtime_error("JSON field '" + key + "' point " +
                                 std::to_string(point_index) +
                                 " coordinates must be finite");
    }
    return coordinate;
}

std::vector<Point2D> read_points(const boost::property_tree::ptree& value,
                                 const std::string& key) {
    if (value.empty() && !value.data().empty()) {
        throw std::runtime_error("JSON field '" + key + "' must be an array");
    }

    std::vector<Point2D> points;
    points.reserve(value.size());
    std::size_t index = 0;
    for (const auto& entry : value) {
        const auto& point = entry.second;
        if (!entry.first.empty() || point.size() != 2 ||
            !point.front().first.empty() || !point.back().first.empty() ||
            !point.front().second.empty() || !point.back().second.empty()) {
            throw std::runtime_error("JSON field '" + key +
                                     "' must contain [x, y] numeric points");
        }

        points.push_back({read_coordinate(point.front().second, key, index),
                          read_coordinate(point.back().second, key, index)});
        ++index;
    }

    return points;
}

void calculate_path_metrics(RobotData& robot_data) {
    const auto& waypoints = robot_data.robot_waypoints;
    robot_data.headings_rad.clear();
    robot_data.headings_rad.reserve(waypoints.size());
    robot_data.path_length_m = 0.0;

    for (std::size_t index = 0; index < waypoints.size(); ++index) {
        if (waypoints.size() < 2) {
            robot_data.headings_rad.push_back(0.0);
            continue;
        }

        const bool is_last = index == waypoints.size() - 1;
        const Point2D& current = waypoints[index];
        const Point2D& next = waypoints[is_last ? index - 1 : index + 1];
        const double dx = next.x - current.x;
        const double dy = next.y - current.y;

        if (!is_last) {
            robot_data.path_length_m += std::hypot(dx, dy);
        }

        robot_data.headings_rad.push_back(
            is_last ? std::atan2(-dy, -dx) : std::atan2(dy, dx));
    }
}

}  // namespace

RobotData read_robot_data(const std::filesystem::path& json_file) {
    std::ifstream input(json_file);
    if (!input) {
        throw std::runtime_error("could not open file");
    }

    boost::property_tree::ptree document;
    boost::property_tree::read_json(input, document);

    for (const char* key : {"path", "robot", "cleaning_gadget"}) {
        if (!document.get_child_optional(key)) {
            throw std::runtime_error(std::string("missing JSON field '") + key +
                                     "'");
        }
    }

    RobotData robot_data{
        read_points(document.get_child("path"), "path"),
        read_points(document.get_child("robot"), "robot"),
        read_points(document.get_child("cleaning_gadget"), "cleaning_gadget"),
    };
    calculate_path_metrics(robot_data);
    return robot_data;
}

void write_visualization_data(const RobotData& robot_data,
                              const std::filesystem::path& output_file) {
    std::ofstream output(output_file);
    if (!output) {
        throw std::runtime_error("could not open output file '" +
                                 output_file.string() + "'");
    }

    output << std::setprecision(std::numeric_limits<double>::max_digits10)
           << "{\n  \"path_length_m\": " << robot_data.path_length_m
           << ",\n  \"headings_rad\": [";
    for (std::size_t index = 0; index < robot_data.headings_rad.size(); ++index) {
        if (index != 0) {
            output << ',';
        }
        output << robot_data.headings_rad[index];
    }
    output << "]\n}\n";

    if (!output) {
        throw std::runtime_error("failed to write output file '" +
                                 output_file.string() + "'");
    }
}

}  // namespace data_analysis
