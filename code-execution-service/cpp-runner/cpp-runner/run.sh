#!/bin/bash

# Navigate to mounted folder
cd /app || exit

# Compile code.cpp
g++ code.cpp -o program 2> errors.txt

# Check compilation errors
if [ -s errors.txt ]; then
    echo "ERROR::$(cat errors.txt)"
    exit
fi

# Run the program with input.txt if it exists
if [ -f input.txt ]; then
    timeout 5s ./program < input.txt
else
    timeout 5s ./program
fi
