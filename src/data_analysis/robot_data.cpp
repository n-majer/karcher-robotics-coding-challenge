#include "data_analysis/robot_data.hpp"

#include <algorithm>
#include <cmath>
#include <fstream>
#include <initializer_list>
#include <iomanip>
#include <limits>
#include <numeric>
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

WaypointDistanceStatistics calculate_distance_statistics(
    const std::vector<double>& distances) {
    const auto [minimum, maximum] =
        std::minmax_element(distances.begin(), distances.end());
    const double mean =
        std::accumulate(distances.begin(), distances.end(), 0.0) /
        static_cast<double>(distances.size());
    return {*minimum, *maximum, mean};
}

std::optional<WaypointDistanceStatistics> calculate_heading_change_statistics(
    const std::vector<double>& headings) {
    if (headings.size() < 2) {
        return std::nullopt;
    }

    std::vector<double> changes;
    changes.reserve(headings.size() - 1);
    for (std::size_t index = 1; index < headings.size(); ++index) {
        const double difference = headings[index] - headings[index - 1];
        changes.push_back(std::abs(std::atan2(std::sin(difference),
                                              std::cos(difference))));
    }
    return calculate_distance_statistics(changes);
}

void calculate_path_metrics(RobotData& robot_data) {
    const auto& waypoints = robot_data.robot_waypoints;
    robot_data.headings.clear();
    robot_data.headings.reserve(waypoints.size());
    robot_data.adapted_heading_variants.clear();
    robot_data.adapted_heading_variants.reserve(heading_distance_windows.size());
    for (double window : heading_distance_windows) {
        robot_data.adapted_heading_variants.push_back(
            HeadingEstimationVariant{window, {}, {}, std::nullopt, std::nullopt});
        robot_data.adapted_heading_variants.back().headings.reserve(
            waypoints.size());
        if (waypoints.size() > 1) {
            robot_data.adapted_heading_variants.back().distances.reserve(
                waypoints.size());
        }
    }
    robot_data.waypoint_distances.clear();
    if (waypoints.size() > 1) {
        robot_data.waypoint_distances.reserve(waypoints.size() - 1);
    }
    robot_data.path_length = 0.0;

    for (std::size_t index = 0; index < waypoints.size(); ++index) {
        if (waypoints.size() < 2) {
            robot_data.headings.push_back(0.0);
            for (auto& variant : robot_data.adapted_heading_variants) {
                variant.headings.push_back(0.0);
            }
            continue;
        }

        const bool is_last = index == waypoints.size() - 1;
        const Point2D& current = waypoints[index];
        const Point2D& next = waypoints[is_last ? index - 1 : index + 1];
        const double dx = next.x - current.x;
        const double dy = next.y - current.y;

        if (!is_last) {
            const double distance = std::hypot(dx, dy);
            robot_data.path_length += distance;
            robot_data.waypoint_distances.push_back(distance);
        }

        robot_data.headings.push_back(
            is_last ? std::atan2(-dy, -dx) : std::atan2(dy, dx));

        for (auto& variant : robot_data.adapted_heading_variants) {
            std::size_t left_index = index;
            std::size_t right_index = index;
            if (index == 0) {
                right_index = index + 1;
                while (right_index + 1 < waypoints.size() &&
                       std::hypot(
                           waypoints[right_index].x - waypoints[index].x,
                           waypoints[right_index].y - waypoints[index].y) <
                           variant.window_distance) {
                    ++right_index;
                }
            } else if (is_last) {
                left_index = index - 1;
                while (left_index > 0 &&
                       std::hypot(
                           waypoints[index].x - waypoints[left_index].x,
                           waypoints[index].y - waypoints[left_index].y) <
                           variant.window_distance) {
                    --left_index;
                }
            } else {
                const std::size_t max_offset =
                    std::min(index, waypoints.size() - 1 - index);
                std::size_t offset = 1;
                for (; offset < max_offset; ++offset) {
                    const Point2D& left = waypoints[index - offset];
                    const Point2D& right = waypoints[index + offset];
                    if (std::hypot(right.x - left.x, right.y - left.y) >=
                        variant.window_distance) {
                        break;
                    }
                }
                left_index = index - offset;
                right_index = index + offset;
            }

            const Point2D& left = waypoints[left_index];
            const Point2D& right = waypoints[right_index];
            variant.headings.push_back(
                std::atan2(right.y - left.y, right.x - left.x));
            variant.distances.push_back(
                std::hypot(right.x - left.x, right.y - left.y));
        }
    }

    if (!robot_data.waypoint_distances.empty()) {
        robot_data.waypoint_distance_statistics = calculate_distance_statistics(
            robot_data.waypoint_distances);
    } else {
        robot_data.waypoint_distance_statistics.reset();
    }

    for (auto& variant : robot_data.adapted_heading_variants) {
        if (!variant.distances.empty()) {
            variant.distance_statistics =
                calculate_distance_statistics(variant.distances);
        }
        variant.heading_change_statistics =
            calculate_heading_change_statistics(variant.headings);
    }
    robot_data.heading_change_statistics =
        calculate_heading_change_statistics(robot_data.headings);
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
           << "{\n  \"path_length\": " << robot_data.path_length
           << ",\n  \"headings\": [";
    for (std::size_t index = 0; index < robot_data.headings.size(); ++index) {
        if (index != 0) {
            output << ',';
        }
        output << robot_data.headings[index];
    }
    output << "],\n  \"heading_change_statistics\": ";
    if (robot_data.heading_change_statistics) {
        const auto& statistics = *robot_data.heading_change_statistics;
        output << "{ \"minimum\": " << statistics.minimum
               << ", \"maximum\": " << statistics.maximum
               << ", \"mean\": " << statistics.mean << " }";
    } else {
        output << "null";
    }
    output << ",\n  \"adapted_heading_variants\": [";
    for (std::size_t variant_index = 0;
         variant_index < robot_data.adapted_heading_variants.size();
         ++variant_index) {
        if (variant_index != 0) {
            output << ',';
        }
        const auto& variant =
            robot_data.adapted_heading_variants[variant_index];
        output << "\n    {\n      \"window_distance\": "
               << variant.window_distance << ",\n      \"headings\": [";
        for (std::size_t index = 0; index < variant.headings.size(); ++index) {
            if (index != 0) {
                output << ',';
            }
            output << variant.headings[index];
        }
        output << "],\n      \"distances\": [";
        for (std::size_t index = 0; index < variant.distances.size(); ++index) {
            if (index != 0) {
                output << ',';
            }
            output << variant.distances[index];
        }
        output << "],\n      \"distance_statistics\": ";
        if (variant.distance_statistics) {
            const auto& statistics = *variant.distance_statistics;
            output << "{ \"minimum\": " << statistics.minimum
                   << ", \"maximum\": " << statistics.maximum
                   << ", \"mean\": " << statistics.mean << " }";
        } else {
            output << "null";
        }
        output << ",\n      \"heading_change_statistics\": ";
        if (variant.heading_change_statistics) {
            const auto& statistics = *variant.heading_change_statistics;
            output << "{ \"minimum\": " << statistics.minimum
                   << ", \"maximum\": " << statistics.maximum
                   << ", \"mean\": " << statistics.mean << " }";
        } else {
            output << "null";
        }
        output << "\n    }";
    }
    output << "\n  ],\n  \"waypoint_distances\": [";
    for (std::size_t index = 0;
         index < robot_data.waypoint_distances.size(); ++index) {
        if (index != 0) {
            output << ',';
        }
        output << robot_data.waypoint_distances[index];
    }
    output << "],\n  \"waypoint_distance_statistics\": ";
    if (robot_data.waypoint_distance_statistics) {
        const auto& statistics = *robot_data.waypoint_distance_statistics;
        output << "{\n"
               << "    \"minimum\": " << statistics.minimum << ",\n"
               << "    \"maximum\": " << statistics.maximum << ",\n"
               << "    \"mean\": " << statistics.mean << "\n"
               << "  }";
    } else {
        output << "null";
    }
    output << "\n}\n";

    if (!output) {
        throw std::runtime_error("failed to write output file '" +
                                 output_file.string() + "'");
    }
}

}  // namespace data_analysis
