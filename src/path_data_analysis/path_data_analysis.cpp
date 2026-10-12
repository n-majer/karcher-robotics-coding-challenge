#include "path_data_analysis/path_data_analysis.hpp"

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
#include <boost/geometry/algorithms/area.hpp>
#include <boost/geometry/algorithms/correct.hpp>
#include <boost/geometry/algorithms/convex_hull.hpp>
#include <boost/geometry/algorithms/is_valid.hpp>
#include <boost/geometry/algorithms/union.hpp>
#include <boost/geometry/geometries/multi_polygon.hpp>
#include <boost/geometry/geometries/multi_point.hpp>
#include <boost/geometry/geometries/point_xy.hpp>
#include <boost/geometry/geometries/polygon.hpp>
#include <boost/property_tree/json_parser.hpp>
#include <boost/property_tree/ptree.hpp>

namespace data_analysis {
namespace {

namespace geometry = boost::geometry;
using GeometryPoint = geometry::model::d2::point_xy<double>;
using GeometryMultiPoint = geometry::model::multi_point<GeometryPoint>;
using GeometryPolygon = geometry::model::polygon<GeometryPoint>;
using GeometryMultiPolygon = geometry::model::multi_polygon<GeometryPolygon>;

struct CleanedArea {
    double area;
    std::vector<std::vector<std::vector<Point2D>>> polygons;
};

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

std::vector<CurvatureApproximation> calculate_curvature_approximations(
    const std::vector<Point2D>& waypoints,
    const std::vector<std::size_t>& waypoint_indices,
    const std::vector<double>& headings) {
    if (waypoint_indices.size() != waypoints.size() ||
        headings.size() != waypoints.size()) {
        throw std::runtime_error(
            "curvature calculation requires matching filtered waypoints, "
            "indices, and headings");
    }

    std::vector<CurvatureApproximation> approximations;
    if (waypoints.size() < 2) {
        return approximations;
    }
    approximations.reserve(waypoints.size() - 1);
    for (std::size_t index = 0; index + 1 < waypoints.size(); ++index) {
        const double heading_difference = headings[index + 1] - headings[index];
        const double heading_change =
            std::atan2(std::sin(heading_difference),
                       std::cos(heading_difference));
        const double distance =
            std::hypot(waypoints[index + 1].x - waypoints[index].x,
                       waypoints[index + 1].y - waypoints[index].y);
        if (distance <= 0.0) {
            throw std::runtime_error(
                "curvature calculation encountered coincident filtered "
                "waypoints");
        }
        approximations.push_back(
            {waypoint_indices[index], waypoint_indices[index],
             waypoint_indices[index + 1],
             heading_change, distance, heading_change / distance});
    }
    return approximations;
}

std::vector<CurvatureApproximation> calculate_windowed_curvature_approximations(
    const std::vector<Point2D>& waypoints,
    const std::vector<std::size_t>& waypoint_indices,
    const std::vector<double>& headings,
    double minimum_window_distance) {
    if (waypoint_indices.size() != waypoints.size() ||
        headings.size() != waypoints.size()) {
        throw std::runtime_error(
            "windowed curvature calculation requires matching filtered "
            "waypoints, indices, and headings");
    }

    std::vector<CurvatureApproximation> approximations;
    approximations.reserve(waypoints.size());
    for (std::size_t index = 0; index < waypoints.size(); ++index) {
        if (waypoints.size() < 2) {
            break;
        }

        std::size_t left_index = index;
        std::size_t right_index = index;
        if (index == 0) {
            right_index = index + 1;
            while (right_index + 1 < waypoints.size() &&
                   std::hypot(waypoints[right_index].x - waypoints[index].x,
                              waypoints[right_index].y - waypoints[index].y) <
                       minimum_window_distance) {
                ++right_index;
            }
        } else if (index == waypoints.size() - 1) {
            left_index = index - 1;
            while (left_index > 0 &&
                   std::hypot(waypoints[index].x - waypoints[left_index].x,
                              waypoints[index].y - waypoints[left_index].y) <
                       minimum_window_distance) {
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
                    minimum_window_distance) {
                    break;
                }
            }
            left_index = index - offset;
            right_index = index + offset;
        }

        const double distance =
            std::hypot(waypoints[right_index].x - waypoints[left_index].x,
                       waypoints[right_index].y - waypoints[left_index].y);
        if (distance <= 0.0) {
            throw std::runtime_error(
                "windowed curvature calculation encountered coincident "
                "neighboring waypoints");
        }
        const double raw_heading_change =
            headings[right_index] - headings[left_index];
        const double heading_change =
            std::atan2(std::sin(raw_heading_change),
                       std::cos(raw_heading_change));
        approximations.push_back(
            {waypoint_indices[index], waypoint_indices[left_index],
             waypoint_indices[right_index], heading_change, distance,
             heading_change / distance});
    }
    return approximations;
}

double calculate_speed(double curvature) {
    const double magnitude = std::abs(curvature);
    if (magnitude < curvature_critical) {
        return maximum_speed;
    }
    if (magnitude < curvature_maximum) {
        const double slowdown =
            (maximum_speed - minimum_speed) /
            (curvature_maximum - curvature_critical);
        return maximum_speed - slowdown * (magnitude - curvature_critical);
    }
    return minimum_speed;
}

void calculate_velocities_and_traversal_time(
    RobotData& robot_data,
    const std::vector<Point2D>& filtered_waypoints) {
    robot_data.waypoint_velocities.clear();
    robot_data.traversal_time = 0.0;
    const auto& approximations =
        robot_data.windowed_curvature_approximations;
    if (approximations.empty()) {
        return;
    }

    if (approximations.size() != filtered_waypoints.size()) {
        throw std::runtime_error(
            "velocity calculation requires one windowed curvature per "
            "filtered waypoint");
    }

    robot_data.waypoint_velocities.reserve(approximations.size());
    std::vector<double> speeds;
    speeds.reserve(approximations.size());
    for (const auto& approximation : approximations) {
        const double speed = calculate_speed(approximation.curvature);
        robot_data.waypoint_velocities.push_back(
            {approximation.waypoint_index, approximation.curvature, speed});
        speeds.push_back(speed);
    }
    for (std::size_t index = 1; index < approximations.size(); ++index) {
        const double segment_distance =
            std::hypot(filtered_waypoints[index].x -
                           filtered_waypoints[index - 1].x,
                       filtered_waypoints[index].y -
                           filtered_waypoints[index - 1].y);
        const double average_speed = (speeds[index - 1] + speeds[index]) / 2.0;
        robot_data.traversal_time += segment_distance / average_speed;
    }
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

std::vector<std::size_t> subsample_waypoint_indices(
    const std::vector<Point2D>& waypoints,
    double minimum_distance) {
    std::vector<std::size_t> subsampled_indices;
    if (waypoints.empty()) {
        return subsampled_indices;
    }
    subsampled_indices.reserve(waypoints.size());
    subsampled_indices.push_back(0);
    for (std::size_t index = 1; index < waypoints.size(); ++index) {
        const Point2D& last_kept = waypoints[subsampled_indices.back()];
        if (std::hypot(waypoints[index].x - last_kept.x,
                       waypoints[index].y - last_kept.y) >= minimum_distance) {
            subsampled_indices.push_back(index);
        }
    }
    return subsampled_indices;
}

Point2D transform_gadget_point(const Point2D& waypoint,
                               const Point2D& gadget_point,
                               double heading) {
    const double cosine = std::cos(heading);
    const double sine = std::sin(heading);
    return {waypoint.x + gadget_point.x * cosine - gadget_point.y * sine,
            waypoint.y + gadget_point.x * sine + gadget_point.y * cosine};
}

CleanedArea calculate_cleaned_area(const std::vector<Point2D>& waypoints,
                                   const std::vector<double>& headings,
                                   const std::vector<Point2D>& cleaning_gadget) {
    if (cleaning_gadget.size() != 2) {
        throw std::runtime_error(
            "cleaning area calculation requires exactly two cleaning gadget "
            "segment endpoints");
    }
    if (waypoints.size() != headings.size()) {
        throw std::runtime_error(
            "cleaning area calculation requires one heading per waypoint");
    }
    if (waypoints.size() < 2) {
        return {0.0, {}};
    }

    GeometryMultiPolygon cleaned_region;
    for (std::size_t index = 1; index < waypoints.size(); ++index) {
        const Point2D start_a = transform_gadget_point(
            waypoints[index - 1], cleaning_gadget[0], headings[index - 1]);
        const Point2D start_b = transform_gadget_point(
            waypoints[index - 1], cleaning_gadget[1], headings[index - 1]);
        const Point2D end_a = transform_gadget_point(
            waypoints[index], cleaning_gadget[0], headings[index]);
        const Point2D end_b = transform_gadget_point(
            waypoints[index], cleaning_gadget[1], headings[index]);

        GeometryMultiPoint corners;
        corners.emplace_back(start_a.x, start_a.y);
        corners.emplace_back(end_a.x, end_a.y);
        corners.emplace_back(end_b.x, end_b.y);
        corners.emplace_back(start_b.x, start_b.y);
        GeometryPolygon swept_segment;
        geometry::convex_hull(corners, swept_segment);
        geometry::correct(swept_segment);
        if (!geometry::is_valid(swept_segment)) {
            throw std::runtime_error(
                "cleaning area calculation produced an invalid swept polygon");
        }

        GeometryMultiPolygon merged_region;
        if (cleaned_region.empty()) {
            cleaned_region.push_back(std::move(swept_segment));
        } else {
            geometry::union_(cleaned_region, swept_segment, merged_region);
            cleaned_region = std::move(merged_region);
        }
    }
    CleanedArea result{geometry::area(cleaned_region), {}};
    result.polygons.reserve(cleaned_region.size());
    for (const auto& polygon : cleaned_region) {
        std::vector<std::vector<Point2D>> rings;
        const auto append_ring = [&rings](const auto& source_ring) {
            std::vector<Point2D> ring;
            ring.reserve(source_ring.size());
            for (const auto& point : source_ring) {
                ring.push_back({geometry::get<0>(point), geometry::get<1>(point)});
            }
            rings.push_back(std::move(ring));
        };
        append_ring(polygon.outer());
        for (const auto& inner_ring : polygon.inners()) {
            append_ring(inner_ring);
        }
        result.polygons.push_back(std::move(rings));
    }
    return result;
}

void calculate_path_metrics(RobotData& robot_data) {
    const auto& waypoints = robot_data.robot_waypoints;
    robot_data.headings.clear();
    robot_data.headings.reserve(waypoints.size());
    robot_data.subsampled_heading_estimation = {};
    robot_data.waypoint_distances.clear();
    if (waypoints.size() > 1) {
        robot_data.waypoint_distances.reserve(waypoints.size() - 1);
    }
    robot_data.path_length = 0.0;

    for (std::size_t index = 0; index < waypoints.size(); ++index) {
        if (waypoints.size() < 2) {
            robot_data.headings.push_back(0.0);
            continue;
        }

        const bool is_last = index == waypoints.size() - 1;
        const Point2D& current = waypoints[index];
        const Point2D& next = waypoints[is_last ? index - 1 : index + 1];
        const double dx = next.x - current.x;
        const double dy = next.y - current.y;

        if (!is_last) {
            const double distance = std::hypot(dx, dy);
            robot_data.waypoint_distances.push_back(distance);
        }

        robot_data.headings.push_back(
            is_last ? std::atan2(-dy, -dx) : std::atan2(dy, dx));
    }

    auto& subsampled_estimation = robot_data.subsampled_heading_estimation;
    subsampled_estimation.waypoint_indices =
        subsample_waypoint_indices(waypoints, subsampling_distance);
    std::vector<Point2D> subsampled_waypoints;
    subsampled_waypoints.reserve(subsampled_estimation.waypoint_indices.size());
    for (std::size_t index : subsampled_estimation.waypoint_indices) {
        subsampled_waypoints.push_back(waypoints[index]);
    }
    for (std::size_t index = 1; index < subsampled_waypoints.size(); ++index) {
        robot_data.path_length +=
            std::hypot(subsampled_waypoints[index].x -
                           subsampled_waypoints[index - 1].x,
                       subsampled_waypoints[index].y -
                           subsampled_waypoints[index - 1].y);
    }
    auto estimated_headings =
        estimate_headings(subsampled_waypoints, heading_window_distance);
    subsampled_estimation.headings = std::move(estimated_headings.first);
    robot_data.curvature_approximations = calculate_curvature_approximations(
        subsampled_waypoints, subsampled_estimation.waypoint_indices,
        subsampled_estimation.headings);
    robot_data.windowed_curvature_approximations =
        calculate_windowed_curvature_approximations(
            subsampled_waypoints, subsampled_estimation.waypoint_indices,
            subsampled_estimation.headings, heading_window_distance);
    calculate_velocities_and_traversal_time(robot_data, subsampled_waypoints);

    auto cleaned_area = calculate_cleaned_area(
        subsampled_waypoints, subsampled_estimation.headings,
        robot_data.cleaning_gadget);
    robot_data.cleaned_area = cleaned_area.area;
    robot_data.cleaned_area_geometry = std::move(cleaned_area.polygons);
}

}  // namespace

RobotData read_robot_data(const std::filesystem::path& json_file) {
    std::ifstream input(json_file);
    if (!input) {
        throw std::runtime_error("could not open file");
    }

    return read_robot_data(input);
}

RobotData read_robot_data(std::istream& json_input) {
    boost::property_tree::ptree document;
    boost::property_tree::read_json(json_input, document);

    for (const char* key : {"path", "robot", "cleaning_gadget"}) {
        if (!document.get_child_optional(key)) {
            throw std::runtime_error(std::string("missing JSON field '") + key +
                                     "'");
        }
    }

    RobotData robot_data{};
    robot_data.robot_waypoints =
        read_points(document.get_child("path"), "path");
    robot_data.robot_footprint =
        read_points(document.get_child("robot"), "robot");
    robot_data.cleaning_gadget =
        read_points(document.get_child("cleaning_gadget"), "cleaning_gadget");
    calculate_path_metrics(robot_data);
    return robot_data;
}

void write_visualization_data(const RobotData& robot_data,
                              const std::filesystem::path& output_file) {
    if (!output_file.parent_path().empty()) {
        std::filesystem::create_directories(output_file.parent_path());
    }

    std::ofstream output(output_file);
    if (!output) {
        throw std::runtime_error("could not open output file '" +
                                 output_file.string() + "'");
    }

    output << std::setprecision(std::numeric_limits<double>::max_digits10)
           << "{\n  \"path_length\": " << robot_data.path_length
           << ",\n  \"cleaned_area\": " << robot_data.cleaned_area
           << ",\n  \"traversal_time\": " << robot_data.traversal_time
           << "\n}\n";

    if (!output) {
        throw std::runtime_error("failed to write output file '" +
                                 output_file.string() + "'");
    }
}

}  // namespace data_analysis
