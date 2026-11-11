import {buildTests} from './build-test-suite.mjs';
import {fileURLToPath} from 'node:url';
buildTests(fileURLToPath(new URL('../',import.meta.url)));
