#!/bin/bash
set -euo pipefail
scriptdir=$(cd $(dirname $0) && pwd)

echo '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
echo 'CLI Integration Tests'
echo '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'

cd $scriptdir

source ../common/jest-test.bash
invokeJest "$@"
