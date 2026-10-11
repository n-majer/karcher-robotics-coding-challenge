cmake_minimum_required(VERSION 3.16)

project(karcher_robotics_challenge LANGUAGES CXX)

find_package(Boost 1.65 REQUIRED)

add_library(data_analysis_lib src/data_analysis/robot_data.cpp)
target_include_directories(data_analysis_lib PUBLIC include)
target_include_directories(data_analysis_lib PRIVATE ${Boost_INCLUDE_DIRS})
target_compile_features(data_analysis_lib PUBLIC cxx_std_17)

add_executable(data_analysis src/data_analysis/main.cpp)
target_link_libraries(data_analysis PRIVATE data_analysis_lib)
