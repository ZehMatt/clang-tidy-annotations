# clang-tidy-annotations
clang-tidy-annotations is a GitHub Action that can be used to annotate files on pull requests with clang-tidy. It aims to be easy to use
with CMake based projects. This project was inspired by `clang-tidy-review` but is doing things a bit different.

Instead of creating review comments it will use annotations only and has builtin support to fail the job if clang-tidy found any
issues. clang-tidy-annotations relies on CMake as it uses [CMAKE_EXPORT_COMPILE_COMMANDS](https://cmake.org/cmake/help/latest/variable/CMAKE_EXPORT_COMPILE_COMMANDS.html)
instead of having the user to manually configure include paths and preprocessor definitions. It also attempts to simplify a few things
with options provided by the action. The action also expects a `.clang-tidy` file, clang-tidy checks can be currently not set by an input, 
this was done to keep the CI close as possible to the local development side.

## Limitations
clang-tidy-annotations relies on CMake to export the configuration via [CMAKE_EXPORT_COMPILE_COMMANDS](https://cmake.org/cmake/help/latest/variable/CMAKE_EXPORT_COMPILE_COMMANDS.html),
additional support might be provided in the future to make it easier for a setup without CMake. The user is also responsible of providing clang-tidy in the
environment where the job runs, clang-tidy is not provided out of the box but can be typically obtained via a prior step using a package manager or a custom
container image.

## Example
If the project were to be build with `cmake . -B build -G Ninja -DCMAKE_C_COMPILER=clang -DCMAKE_CXX_COMPILER=clang++` then you would use following:
```yml
name: clang-tidy-check
on: [pull_request]

jobs:
  clang-tidy-check:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Get clang-tidy
      run: |
        apt-get update
        apt-get install -y clang-tidy
    - uses: ZehMatt/clang-tidy-annotations@v1.0.0
      with:
        build_dir: 'build'
        cmake_args: '-G Ninja -DCMAKE_C_COMPILER=clang -DCMAKE_CXX_COMPILER=clang++'
```
In case there are multiple build configurations its best to use a matrix for each.

## Inputs

- `github_token`: Authentication token, requires only read permissions.
  - default: `${{ github.token }}`
  - required: true
- `source_dir`: Directory containing the source files.
  - default: `.`
  - required: true
- `build_dir`: The directory in where CMake will create the build (-B).
  - default: `.`
  - required: true
- `file_filter`: A list of file extensions, files that do not match the filter will not be passed to clang-tidy.
  - default: `cpp,h,hpp,c,cc,cxx,hxx`
  - required: true
- `only_affected_lines`: Only annotates lines that were changed in the PR.
  - default: true
  - required: false
- `cmake_args`: Additional CMake arguments.
  - default: ''
  - required: false
- `clang_tidy_args`: Additional clang-tidy arguments.
  - default: ''
  - required: false
- `clang_tidy_file`: Path to .clang-tidy file.
  - default: `.clang-tidy`
  - required: true
- `warnings_as_errors`: Treats all warnings as errors.
  - default: true
  - required: false
- `fail_on_problems`: Fail the action if there are any problems found by clang-tidy.
  - default: true
  - required: false