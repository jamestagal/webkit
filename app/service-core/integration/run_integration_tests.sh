#!/bin/bash

# Integration Test Runner for Consultation Domain
# This script runs comprehensive integration tests and provides detailed reporting

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_TIMEOUT=${TEST_TIMEOUT:-"10m"}
VERBOSE=${VERBOSE:-"false"}
SHORT_MODE=${SHORT_MODE:-"false"}
DB_TYPE=${DB_TYPE:-"sqlite"}
OUTPUT_DIR=${OUTPUT_DIR:-"./test-results"}

# Print header
echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}  Consultation Domain Integration Test Suite    ${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Environment information
echo -e "${YELLOW}Environment Information:${NC}"
echo "  Go version: $(go version)"
echo "  Test timeout: $TEST_TIMEOUT"
echo "  Database type: $DB_TYPE"
echo "  Short mode: $SHORT_MODE"
echo "  Output directory: $OUTPUT_DIR"
echo ""

# Set environment variables for tests
export TEST_DATABASE_TYPE="$DB_TYPE"
export OUTPUT_DIR="$OUTPUT_DIR"

if [[ "$DB_TYPE" == "postgres" ]]; then
    export USE_POSTGRES="true"
    export TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgres://postgres:password@localhost:5432/prop_gen_test?sslmode=disable}"
    echo "  PostgreSQL URL: $TEST_DATABASE_URL"
else
    export USE_POSTGRES="false"
    echo "  Using SQLite in-memory database"
fi

echo ""

# Function to run a specific test suite
run_test_suite() {
    local suite_name="$1"
    local test_pattern="$2"
    local required="$3"

    echo -e "${BLUE}Running $suite_name...${NC}"

    if [[ "$SHORT_MODE" == "true" ]] && [[ "$required" == "false" ]]; then
        echo -e "${YELLOW}  Skipping $suite_name (optional in short mode)${NC}"
        return 0
    fi

    local output_file="$OUTPUT_DIR/${suite_name,,}.log"
    local start_time=$(date +%s)

    local test_args="-v -timeout=$TEST_TIMEOUT"
    if [[ "$SHORT_MODE" == "true" ]]; then
        test_args="$test_args -short"
    fi

    if [[ "$VERBOSE" == "true" ]]; then
        test_args="$test_args -v"
    fi

    # Run the test suite
    if go test $test_args -run="$test_pattern" . > "$output_file" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        echo -e "${GREEN}  ✅ $suite_name passed (${duration}s)${NC}"

        # Extract key metrics from output
        local test_count=$(grep -c "^=== RUN" "$output_file" || echo "0")
        echo "    Tests run: $test_count"

        return 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        echo -e "${RED}  ❌ $suite_name failed (${duration}s)${NC}"

        # Show error details
        echo "    Error details (last 10 lines):"
        tail -10 "$output_file" | sed 's/^/      /'

        return 1
    fi
}

# Function to run database setup tests
setup_database_tests() {
    echo -e "${BLUE}Setting up database for testing...${NC}"

    # Test database connectivity
    if ! go test -v -run="TestDatabaseConnectivity" . > "$OUTPUT_DIR/database_setup.log" 2>&1; then
        echo -e "${RED}  ❌ Database setup failed${NC}"
        echo "    Check database configuration and connectivity"
        cat "$OUTPUT_DIR/database_setup.log" | tail -5 | sed 's/^/      /'
        return 1
    fi

    echo -e "${GREEN}  ✅ Database setup successful${NC}"
    return 0
}

# Function to validate environment
validate_environment() {
    echo -e "${BLUE}Validating test environment...${NC}"

    # Check if Go is available
    if ! command -v go >/dev/null 2>&1; then
        echo -e "${RED}  ❌ Go is not installed or not in PATH${NC}"
        return 1
    fi

    # Check if we're in the right directory
    if [[ ! -f "integration_suite_test.go" ]]; then
        echo -e "${RED}  ❌ Not in the correct directory (integration tests not found)${NC}"
        return 1
    fi

    # Check database drivers
    if ! go list -m github.com/lib/pq >/dev/null 2>&1 && ! go list -m modernc.org/sqlite >/dev/null 2>&1; then
        echo -e "${RED}  ❌ Required database drivers not available${NC}"
        return 1
    fi

    echo -e "${GREEN}  ✅ Environment validation passed${NC}"
    return 0
}

# Function to generate summary report
generate_summary() {
    local total_suites="$1"
    local passed_suites="$2"
    local failed_suites="$3"

    echo ""
    echo -e "${BLUE}=================================================${NC}"
    echo -e "${BLUE}              Test Summary                        ${NC}"
    echo -e "${BLUE}=================================================${NC}"

    echo "Total test suites: $total_suites"
    echo "Passed: $passed_suites"
    echo "Failed: $failed_suites"

    if [[ "$failed_suites" -eq 0 ]]; then
        echo -e "${GREEN}Overall result: ✅ PASS${NC}"
        echo ""
        echo -e "${GREEN}🎉 All integration tests passed!${NC}"
        echo -e "${GREEN}The consultation domain is ready for deployment.${NC}"
    else
        echo -e "${RED}Overall result: ❌ FAIL${NC}"
        echo ""
        echo -e "${RED}⚠️  $failed_suites test suite(s) failed.${NC}"
        echo -e "${RED}Review the logs in $OUTPUT_DIR/ for details.${NC}"
    fi

    # Performance summary
    echo ""
    echo -e "${YELLOW}Performance Summary:${NC}"
    local total_time=0
    for log_file in "$OUTPUT_DIR"/*.log; do
        if [[ -f "$log_file" ]]; then
            local duration=$(grep "seconds" "$log_file" | tail -1 | grep -o '[0-9]*\.[0-9]*' || echo "0")
            total_time=$(echo "$total_time + $duration" | bc 2>/dev/null || echo "$total_time")
        fi
    done
    echo "  Total execution time: ${total_time}s (approximate)"

    # File locations
    echo ""
    echo -e "${YELLOW}Test Artifacts:${NC}"
    echo "  Logs directory: $OUTPUT_DIR/"
    echo "  Individual suite logs: $OUTPUT_DIR/*.log"

    if [[ "$failed_suites" -gt 0 ]]; then
        echo ""
        echo -e "${YELLOW}Next Steps:${NC}"
        echo "  1. Review failed test logs in $OUTPUT_DIR/"
        echo "  2. Fix identified issues"
        echo "  3. Re-run integration tests"
        echo "  4. Do not deploy until all tests pass"
    fi
}

# Main execution
main() {
    # Validate environment
    if ! validate_environment; then
        exit 1
    fi

    # Setup database
    if ! setup_database_tests; then
        exit 1
    fi

    echo ""

    # Define test suites
    # Format: "Display Name" "Test Pattern" "Required (true/false)"
    declare -a test_suites=(
        "Integration Validation|TestIntegrationValidation|true"
        "End-to-End Suite|TestEndToEndSuite|true"
        "Database Integration|TestDatabaseIntegrationSuite|true"
        "API Integration|TestAPIIntegrationSuite|true"
        "Workflow Tests|TestWorkflowSuite|true"
        "Performance Tests|TestPerformanceSuite|false"
        "Stress Tests|TestStressSuite|false"
        "Monitoring Tests|TestMonitoringSuite|true"
        "Comprehensive Suite|TestComprehensiveIntegrationSuite|true"
    )

    local total_suites=0
    local passed_suites=0
    local failed_suites=0

    # Run each test suite
    for suite_info in "${test_suites[@]}"; do
        IFS='|' read -r suite_name test_pattern required <<< "$suite_info"

        total_suites=$((total_suites + 1))

        if run_test_suite "$suite_name" "$test_pattern" "$required"; then
            passed_suites=$((passed_suites + 1))
        else
            failed_suites=$((failed_suites + 1))
        fi

        echo ""
    done

    # Generate summary
    generate_summary "$total_suites" "$passed_suites" "$failed_suites"

    # Exit with appropriate code
    if [[ "$failed_suites" -eq 0 ]]; then
        exit 0
    else
        exit 1
    fi
}

# Handle command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE="true"
            shift
            ;;
        -s|--short)
            SHORT_MODE="true"
            shift
            ;;
        --db)
            DB_TYPE="$2"
            shift 2
            ;;
        --timeout)
            TEST_TIMEOUT="$2"
            shift 2
            ;;
        --output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -h|--help)
            echo "Integration Test Runner for Consultation Domain"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -v, --verbose     Enable verbose output"
            echo "  -s, --short       Run in short mode (skip optional tests)"
            echo "  --db TYPE         Database type (sqlite or postgres)"
            echo "  --timeout TIME    Test timeout (default: 10m)"
            echo "  --output DIR      Output directory for logs (default: ./test-results)"
            echo "  -h, --help        Show this help message"
            echo ""
            echo "Environment Variables:"
            echo "  TEST_DATABASE_URL     PostgreSQL connection string"
            echo "  SKIP_INTEGRATION_TESTS Set to 'true' to skip all tests"
            echo ""
            echo "Examples:"
            echo "  $0                    # Run all tests with SQLite"
            echo "  $0 --db postgres      # Run with PostgreSQL"
            echo "  $0 -s -v              # Short mode with verbose output"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Run main function
main