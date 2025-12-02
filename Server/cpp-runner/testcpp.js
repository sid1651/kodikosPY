// make sure the file name matches
import { runCppCode } from "../services/dockercppRunner.js";

const code = `
#include <iostream>
int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}
`;

const input = "";

runCppCode(code, input).then(result => {
    console.log("Output:", result.output);
});
