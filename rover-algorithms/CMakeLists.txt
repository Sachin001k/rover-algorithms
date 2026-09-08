cmake_minimum_required(VERSION 3.10)
project(RobotVacuumCPP CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(include)

add_executable(robot_vacuum_sim
    src/Grid.cpp
    src/RoomGenerator.cpp
    src/ZigZagAlgorithm.cpp
    src/RandomWalkAlgorithm.cpp
    src/ZigZagWallFollowHybrid.cpp
    src/ZigZagRandomEscapeHybrid.cpp
    src/Simulation.cpp
    src/Metrics.cpp
    src/main.cpp
)
