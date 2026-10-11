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
            {waypoint_indices[index], waypoint_indices[index + 1],
             heading_change, distance, heading_change / distance});
    }
    return approximations;
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
    subsampled_estimation.heading_change_statistics =
        calculate_heading_change_statistics(subsampled_estimation.headings);
    robot_data.curvature_approximations = calculate_curvature_approximations(
        subsampled_waypoints, subsampled_estimation.waypoint_indices,
        subsampled_estimation.headings);

    if (!robot_data.waypoint_distances.empty()) {
        robot_data.waypoint_distance_statistics = calculate_distance_statistics(
            robot_data.waypoint_distances);
    } else {
        robot_data.waypoint_distance_statistics.reset();
    }

    robot_data.heading_change_statistics =
        calculate_heading_change_statistics(robot_data.headings);
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

    boost::property_tree::ptree document;
    boost::property_tree::read_json(input, document);

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
    std::ofstream output(output_file);
    if (!output) {
        throw std::runtime_error("could not open output file '" +
                                 output_file.string() + "'");
    }

    output << std::setprecision(std::numeric_limits<double>::max_digits10)
           << "{\n  \"path_length\": " << robot_data.path_length
           << ",\n  \"cleaned_area\": " << robot_data.cleaned_area
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
    output << ",\n  \"cleaned_area_geometry\": [";
    for (std::size_t polygon_index = 0;
         polygon_index < robot_data.cleaned_area_geometry.size();
         ++polygon_index) {
        if (polygon_index != 0) {
            output << ',';
        }
        output << '[';
        const auto& polygon = robot_data.cleaned_area_geometry[polygon_index];
        for (std::size_t ring_index = 0; ring_index < polygon.size();
             ++ring_index) {
            if (ring_index != 0) {
                output << ',';
            }
            output << '[';
            const auto& ring = polygon[ring_index];
            for (std::size_t point_index = 0; point_index < ring.size();
                 ++point_index) {
                if (point_index != 0) {
                    output << ',';
                }
                output << '[' << ring[point_index].x << ','
                       << ring[point_index].y << ']';
            }
            output << ']';
        }
        output << ']';
    }
    output << ']';
    output << ",\n  \"curvature_approximations\": [";
    for (std::size_t index = 0;
         index < robot_data.curvature_approximations.size(); ++index) {
        if (index != 0) {
            output << ',';
        }
        const auto& approximation = robot_data.curvature_approximations[index];
        output << "\n    { \"start_waypoint_index\": "
               << approximation.start_waypoint_index
               << ", \"end_waypoint_index\": "
               << approximation.end_waypoint_index
               << ", \"heading_change\": " << approximation.heading_change
               << ", \"distance\": " << approximation.distance
               << ", \"curvature\": " << approximation.curvature << " }";
    }
    output << "\n  ]";
    const auto& subsampled_estimation =
        robot_data.subsampled_heading_estimation;
    output << ",\n  \"subsampled_heading_estimation\": {\n"
           << "    \"minimum_waypoint_distance\": " << subsampling_distance
           << ",\n    \"window_distance\": " << heading_window_distance
           << ",\n    \"waypoint_indices\": [";
    for (std::size_t index = 0;
         index < subsampled_estimation.waypoint_indices.size(); ++index) {
        if (index != 0) {
            output << ',';
        }
        output << subsampled_estimation.waypoint_indices[index];
    }
    output << "],\n    \"headings\": [";
    for (std::size_t index = 0;
         index < subsampled_estimation.headings.size(); ++index) {
        if (index != 0) {
            output << ',';
        }
        output << subsampled_estimation.headings[index];
    }
    output << "],\n    \"heading_change_statistics\": ";
    if (subsampled_estimation.heading_change_statistics) {
        const auto& statistics =
            *subsampled_estimation.heading_change_statistics;
        output << "{ \"minimum\": " << statistics.minimum
               << ", \"maximum\": " << statistics.maximum
               << ", \"mean\": " << statistics.mean << " }";
    } else {
        output << "null";
    }
    output << "\n  }";
    output << ",\n  \"waypoint_distances\": [";
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
