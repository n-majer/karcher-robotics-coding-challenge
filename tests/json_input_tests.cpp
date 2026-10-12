#include "path_data_analysis/path_data_analysis.hpp"

#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace {

template <typename Action>
void require_exception_containing(Action&& action,
                                  const std::string& expected_message) {
    try {
        action();
    } catch (const std::exception& error) {
        if (std::string(error.what()).find(expected_message) !=
            std::string::npos) {
            return;
        }
        throw std::runtime_error(
            "Unexpected exception message: " + std::string(error.what()));
    }
    throw std::runtime_error("Expected exception containing: " +
                             expected_message);
}

template <typename Action>
void require_exception(Action&& action) {
    try {
        action();
    } catch (const std::exception&) {
        return;
    }
    throw std::runtime_error("Expected an exception");
}

void rejects_json(const std::string& json, const std::string& message) {
    require_exception_containing(
        [&json] {
            std::istringstream input(json);
            static_cast<void>(data_analysis::read_robot_data(input));
        },
        message);
}

}  // namespace

int main() {
    try {
        const std::string robot =
            R"("robot":[[-0.4,-0.37],[-0.4,0.37],[0.7,0.37],[0.7,-0.37]])";
        const std::string gadget =
            R"("cleaning_gadget":[[0.15,0.3],[0.15,-0.36]])";

        for (const std::string& missing_field :
             {"path", "robot", "cleaning_gadget"}) {
            std::string json = "{";
            bool add_comma = false;
            const std::vector<std::pair<std::string, std::string>> fields{
                {"robot", robot},
                {"cleaning_gadget", gadget},
                {"path", R"("path":[[0,0],[1,0]])"},
            };
            for (const auto& field : fields) {
                if (field.first == missing_field) continue;
                if (add_comma) json += ",";
                json += field.second;
                add_comma = true;
            }
            json += "}";
            rejects_json(json, "missing JSON field '" + missing_field + "'");
        }

        const std::string valid_fields =
            "{" + robot + "," + gadget + ",";
        rejects_json(valid_fields + R"("path":[[0,0,1],[1,0]]})",
                     "must contain [x, y] numeric points");
        rejects_json(valid_fields + R"("path":[[0],[1,0]]})",
                     "must contain [x, y] numeric points");
        rejects_json(valid_fields + R"("path":[["nope",0],[1,0]]})",
                     "must contain numeric coordinates");
        require_exception([&valid_fields] {
            std::istringstream input(
                valid_fields + R"("path":[[1e9999,0],[1,0]]})");
            static_cast<void>(data_analysis::read_robot_data(input));
        });
        require_exception([&valid_fields] {
            std::istringstream input(valid_fields + R"("path":[[0,0],[1,0]})");
            static_cast<void>(data_analysis::read_robot_data(input));
        });
        rejects_json(
            "{" + robot +
                R"(,"cleaning_gadget":[[0,0]],"path":[[0,0],[1,0]]})",
            "exactly two cleaning gadget segment endpoints");

        std::cout << "JSON input validation tests passed\n";
        return 0;
    } catch (const std::exception& error) {
        std::cerr << "JSON input validation test failed: " << error.what()
                  << '\n';
        return 1;
    }
}
