cmake_minimum_required(VERSION 3.16)

project(karcher_robotics_challenge LANGUAGES CXX)

find_package(Boost 1.65 REQUIRED)

add_library(path_data_analysis_lib src/path_data_analysis/path_data_analysis.cpp)
target_include_directories(path_data_analysis_lib PUBLIC include)
target_include_directories(path_data_analysis_lib PRIVATE ${Boost_INCLUDE_DIRS})
target_compile_features(path_data_analysis_lib PUBLIC cxx_std_17)

add_executable(path_data_analysis src/path_data_analysis/main.cpp)
target_link_libraries(path_data_analysis PRIVATE path_data_analysis_lib)

include(CTest)

if(BUILD_TESTING)
    add_executable(json_input_tests tests/json_input_tests.cpp)
    target_link_libraries(json_input_tests PRIVATE path_data_analysis_lib)

    add_executable(edge_path_tests tests/edge_path_tests.cpp)
    target_link_libraries(edge_path_tests PRIVATE path_data_analysis_lib)

    add_test(NAME json_input_validation COMMAND json_input_tests)
    add_test(NAME edge_paths COMMAND edge_path_tests)
endif()
