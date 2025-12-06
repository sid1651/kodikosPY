#!/bin/bash

# Define the delimiter matching the one used in dockercppRunner.js
DELIMITER="---INPUT-STREAM---"

# Read all of stdin into a variable
full_stream=$(cat /dev/stdin)

# Split the stream into code and input parts using awk with the DELIMITER as the Record Separator (RS)
# NR==1 is the code part (before the delimiter)
code_part=$(echo "$full_stream" | awk -v RS="$DELIMITER" 'NR==1 {print; exit}')

# NR==2 is the input part (after the delimiter)
input_part=$(echo "$full_stream" | awk -v RS="$DELIMITER" 'NR==2 {print; exit}')

# --- EXECUTION LOGIC ---

CODE_FILE="/tmp/code.cpp"
ERROR_FILE="/tmp/errors.txt"
OUTPUT_BINARY="/tmp/program"

# 1. Save C++ code to a temporary file for compilation
echo "$code_part" > $CODE_FILE

# 2. Compile code.cpp
g++ $CODE_FILE -o $OUTPUT_BINARY 2> $ERROR_FILE

# Check compilation errors
if [ -s $ERROR_FILE ]; then
    echo "ERROR::$(cat $ERROR_FILE)"
    rm -f $CODE_FILE $OUTPUT_BINARY $ERROR_FILE
    exit
fi

# 3. Run the program, piping the separated input part into its stdin
# Uses 'echo' to send the isolated input string to the program's stdin
echo "$input_part" | timeout 5s $OUTPUT_BINARY

# 4. Cleanup temporary files
rm -f $CODE_FILE $OUTPUT_BINARY $ERROR_FILE