#!/bin/bash

echo "=== Testing Docker Images on Mac Silicon ==="
echo ""

echo "1. Testing sidhu1651/cpp-runner:"
docker run --rm --platform linux/amd64 sidhu1651/cpp-runner g++ --version 2>&1 | head -3
echo ""

echo "2. Testing sidhu1651/kodikos-python:"
docker run --rm --platform linux/amd64 sidhu1651/kodikos-python python3 --version 2>&1 | head -3
echo ""

echo "3. Testing C++ code execution:"
docker run --rm --platform linux/amd64 sidhu1651/cpp-runner sh -c 'echo "#include <iostream>
int main(){std::cout<<\"Hello from C++!\"<<std::endl;}" > /tmp/test.cpp && g++ /tmp/test.cpp -o /tmp/test && /tmp/test' 2>&1
echo ""

echo "4. Testing Python code execution:"
docker run --rm --platform linux/amd64 sidhu1651/kodikos-python python3 -c "print('Hello from Python!')" 2>&1
echo ""

echo "=== Test Complete ==="

