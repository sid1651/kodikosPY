// make sure the file name matches
import { runCppCode } from "../services/dockercppRunner.js";

const code = `
#include <iostream>
int main() {
    int a, b;
    std::cin >> a >> b;
    std::cout << a + b << std::endl;
    return 0;
}
`;

const input = "1 2";

runCppCode(code, input).then(result => {
    console.log("Output:", result.output);
});
