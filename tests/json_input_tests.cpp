#include "data_analysis/robot_data.hpp"

#include <exception>
#include <iostream>
#include <string>

int main(int argc, char* argv[]) {
    if (argc != 2) {
        std::cerr << "Usage: json_input_tests <input.json>\n";
        return 2;
    }

    try {
        static_cast<void>(data_analysis::read_robot_data(argv[1]));
    } catch (const std::exception& error) {
        const std::string message = error.what();
        if (message.find("must contain [x, y] numeric points") !=
            std::string::npos) {
            return 0;
        }
        std::cerr << "Unexpected input error: " << message << '\n';
        return 1;
    }

    std::cerr << "Expected invalid point dimensions to be rejected\n";
    return 1;
}
