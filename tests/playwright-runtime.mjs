// Optional Python Playwright supplies its bundled JavaScript browser driver.
// Production MCP/extension has no Python, Computer Use or npm dependency.
import {spawnSync} from 'node:child_process';
const python=process.env.TOBKIRI_TEST_PYTHON || 'python';
const result=spawnSync(python,['-c',"from pathlib import Path; import playwright; print((Path(playwright.__file__).parent / 'driver' / 'package' / 'index.mjs').as_uri())"],{encoding:'utf8',windowsHide:true});
if(result.status!==0)throw Error('Optional browser tests need Python playwright. Install tests/requirements.txt and set TOBKIRI_TEST_PYTHON to that Python executable.');
export const {chromium}=await import(result.stdout.trim());
