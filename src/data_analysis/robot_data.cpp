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
#include <utility>

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

std::pair<std::vector<double>, std::vector<double>> estimate_headings(
    const std::vector<Point2D>& waypoints,
    double window_distance) {
    std::vector<double> headings;
    std::vector<double> distances;
    headings.reserve(waypoints.size());
    if (waypoints.size() > 1) {
        distances.reserve(waypoints.size());
    }

    for (std::size_t index = 0; index < waypoints.size(); ++index) {
        if (waypoints.size() < 2) {
            headings.push_back(0.0);
            continue;
        }

        std::size_t left_index = index;
        std::size_t right_index = index;
        if (index == 0) {
            right_index = 1;
            while (right_index + 1 < waypoints.size() &&
                   std::hypot(waypoints[right_index].x - waypoints[index].x,
                              waypoints[right_index].y - waypoints[index].y) <
                       window_distance) {
                ++right_index;
            }
        } else if (index == waypoints.size() - 1) {
            left_index = index - 1;
            while (left_index > 0 &&
                   std::hypot(waypoints[index].x - waypoints[left_index].x,
                              waypoints[index].y - waypoints[left_index].y) <
                       window_distance) {
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
                    window_distance) {
                    break;
                }
            }
            left_index = index - offset;
            right_index = index + offset;
        }

        const Point2D& left = waypoints[left_index];
        const Point2D& right = waypoints[right_index];
        headings.push_back(std::atan2(right.y - left.y, right.x - left.x));
        distances.push_back(std::hypot(right.x - left.x, right.y - left.y));
    }
    return {std::move(headings), std::move(distances)};
}

std::vector<double> derive_distance_candidates(
    const std::vector<double>& waypoint_distances) {
    constexpr std::size_t candidate_count = 10;
    if (waypoint_distances.empty()) {
        return {};
    }

    std::vector<double> sorted_distances = waypoint_distances;
    std::sort(sorted_distances.begin(), sorted_distances.end());
    std::vector<double> candidates;
    candidates.reserve(candidate_count);
    for (std::size_t index = 0; index < candidate_count; ++index) {
        const double position =
            static_cast<double>(index) * (sorted_distances.size() - 1) /
            static_cast<double>(candidate_count - 1);
        const auto lower_index = static_cast<std::size_t>(position);
        const auto upper_index = std::min(lower_index + 1,
                                          sorted_distances.size() - 1);
        const double fraction = position - static_cast<double>(lower_index);
        const double candidate =
            sorted_distances[lower_index] +
            (sorted_distances[upper_index] - sorted_distances[lower_index]) *
                fraction;
        if (candidates.empty() || candidate != candidates.back()) {
            candidates.push_back(candidate);
        }
    }
    return candidates;
}

std::vector<Point2D> subsample_path(const std::vector<Point2D>& waypoints,
                                    double minimum_distance) {
    std::vector<Point2D> subsampled;
    if (waypoints.empty()) {
        return subsampled;
    }
    subsampled.reserve(waypoints.size());
    subsampled.push_back(waypoints.front());
    for (std::size_t index = 1; index < waypoints.size(); ++index) {
        const Point2D& last_kept = subsampled.back();
        if (std::hypot(waypoints[index].x - last_kept.x,
                       waypoints[index].y - last_kept.y) >= minimum_distance) {
            subsampled.push_back(waypoints[index]);
        }
    }
    return subsampled;
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

    }

    for (auto& variant : robot_data.adapted_heading_variants) {
        auto [headings, distances] =
            estimate_headings(waypoints, variant.window_distance);
        variant.headings = std::move(headings);
        variant.distances = std::move(distances);
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

    robot_data.subsampling_search.maximum_allowed_heading_change =
        std::acos(-1.0) / 6.0;
    robot_data.subsampling_search.candidate_distances =
        derive_distance_candidates(robot_data.waypoint_distances);
    robot_data.subsampling_search.qualifying_combinations.clear();
    for (double minimum_distance :
         robot_data.subsampling_search.candidate_distances) {
        const auto subsampled = subsample_path(waypoints, minimum_distance);
        for (double window_distance :
             robot_data.subsampling_search.candidate_distances) {
            auto [headings, distances] =
                estimate_headings(subsampled, window_distance);
            const auto statistics =
                calculate_heading_change_statistics(headings);
            if (statistics &&
                statistics->maximum <
                    robot_data.subsampling_search
                        .maximum_allowed_heading_change) {
                robot_data.subsampling_search.qualifying_combinations.push_back(
                    {minimum_distance, window_distance, subsampled.size(),
                     *statistics});
            }
        }
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
    output << ",\n  \"subsampling_search\": {\n"
           << "    \"maximum_allowed_heading_change\": "
           << robot_data.subsampling_search.maximum_allowed_heading_change
           << ",\n    \"candidate_distances\": [";
    for (std::size_t index = 0;
         index < robot_data.subsampling_search.candidate_distances.size();
         ++index) {
        if (index != 0) {
            output << ',';
        }
        output << robot_data.subsampling_search.candidate_distances[index];
    }
    output << "],\n    \"qualifying_combinations\": [";
    for (std::size_t index = 0;
         index <
         robot_data.subsampling_search.qualifying_combinations.size();
         ++index) {
        if (index != 0) {
            output << ',';
        }
        const auto& combination =
            robot_data.subsampling_search.qualifying_combinations[index];
        output << "\n      { \"minimum_waypoint_distance\": "
               << combination.minimum_waypoint_distance
               << ", \"window_distance\": " << combination.window_distance
               << ", \"waypoint_count\": " << combination.waypoint_count
               << ", \"maximum_heading_change\": "
               << combination.heading_change_statistics.maximum
               << ", \"mean_heading_change\": "
               << combination.heading_change_statistics.mean << " }";
    }
    output << "\n    ]\n  }\n}\n";

    if (!output) {
        throw std::runtime_error("failed to write output file '" +
                                 output_file.string() + "'");
    }
}

}  // namespace data_analysis
