import { readFile, writeFile, stat } from 'node:fs/promises';
import {
  normalizeListingResult,
  applyListingLayout,
} from '../src/listing-import.js';
import {
  attachListing,
  validateReferences,
  MAX_REFERENCE_BYTES,
} from '../src/references.js';
import { readProjectFile, validateProject } from '../src/validation.js';

const usage =
  'pnpm listing:import --input private/result.json --out private/listing.json [--project private/home.json | --use-layout] [--bindings private/windows.json]';
async function readJSON(path) {
  if ((await stat(path)).size > MAX_REFERENCE_BYTES)
    throw new Error('Input exceeds 2 MB.');
  return JSON.parse(await readFile(path, 'utf8'));
}
try {
  const args = process.argv.slice(2),
    options = {};
  if (args.includes('--help')) {
    console.log(usage);
    process.exit(0);
  }
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (
      !['--input', '--out', '--project', '--bindings', '--use-layout'].includes(
        key,
      ) ||
      Object.hasOwn(options, key)
    )
      throw new Error(usage);
    options[key] = key === '--use-layout' ? true : args[++i];
    if (!options[key] || String(options[key]).startsWith('--'))
      throw new Error(usage);
  }
  if (
    !options['--input'] ||
    !options['--out'] ||
    (options['--project'] && options['--use-layout'])
  )
    throw new Error(usage);
  const packet = normalizeListingResult(await readJSON(options['--input']));
  let output = packet;
  if (options['--project'])
    output = attachListing(
      readProjectFile(await readJSON(options['--project'])).project,
      packet,
    );
  if (options['--use-layout']) output = applyListingLayout(packet);
  if (options['--bindings']) {
    if (output.format !== 'home-planner')
      throw new Error('--bindings needs --project or --use-layout.');
    output.references.bindings = await readJSON(options['--bindings']);
    output.references = validateReferences(output.references, output);
  }
  if (output.format === 'home-planner') output = validateProject(output);
  const text = JSON.stringify(output, null, 2) + '\n';
  if (Buffer.byteLength(text) > MAX_REFERENCE_BYTES)
    throw new Error('Output exceeds the 2 MB project import limit.');
  // Never overwrite a source plan or an existing output accidentally.
  await writeFile(options['--out'], text, { flag: 'wx', mode: 0o600 });
  console.log(
    `Prepared ${output.format}. Source files unchanged; no images fetched. Open the output in Home Planner.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
