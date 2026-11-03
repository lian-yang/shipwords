import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { creditsFor, sanitizeParameters } from '@shipwords/jobs/models';
import { partsOf } from '@shipwords/jobs/runner';
import { buildYirRequest } from '@shipwords/jobs/yir';
import catalog from '../../site.models';
import models, { guestModels } from '../../src/models.server';

// No job is submitted: exercise the actual catalog, server sanitizer, stored input and upstream serializer.
const inputs = [
  undefined,
  null,
  {},
  { duration: 30 },
  { duration: 'auto' },
  { duration: -1 },
  { duration: 10.5 },
  { duration: 0, seconds: 30, duration_seconds: 30, n: 99, resolution: '1080p' },
  { duration: 30, aspect_ratio: '9:16' },
  { duration: 30, aspect_ratio: '1:1' },
];
const results = [];
for (const [mode, variants] of [
  ['guest', guestModels],
  ['account', models],
] as const) {
  for (const model of variants) {
    const publicModel = catalog.find((item) => item.id === model.id)!;
    assert.equal(publicModel.guest, true);
    assert.equal((publicModel.allowedParameters as readonly string[]).includes('duration'), false);
    for (const [index, input] of inputs.entries()) {
      const parameters = sanitizeParameters(model, input);
      assert.equal(parameters.duration, mode === 'guest' ? 4 : 10);
      assert.equal(parameters.resolution, mode === 'guest' ? '480p' : '720p');
      assert.equal(creditsFor(model, parameters), mode === 'guest' ? 60 : 100);
      assert.equal(parameters.aspect_ratio, input?.aspect_ratio ?? '16:9');
      for (const key of ['seconds', 'duration_seconds', 'n']) {
        assert.equal(key in parameters, false);
      }
      const [part] = partsOf(
        { prompt: 'Duration guard check', inputJson: JSON.stringify({ references: [], parameters }) },
        model,
      );
      const request = buildYirRequest({ ...part, kind: 'video' });
      assert.equal(request.parameters?.duration, mode === 'guest' ? 4 : 10);
      assert.equal(request.parameters?.resolution, mode === 'guest' ? '480p' : '720p');
      assert.equal(request.max_cost, mode === 'guest' ? '0.60' : '2.60');
      results.push({
        mode,
        model: model.id,
        inputCase: index,
        duration: request.parameters?.duration ?? null,
        passed: true,
      });
    }
  }
}
const output = {
  checkedAt: new Date().toISOString(),
  tests: results.length,
  results,
  submittedRealJobs: 0,
};
writeFileSync(
  fileURLToPath(new URL('./parameter-results.json', import.meta.url)),
  `${JSON.stringify(output, null, 2)}\n`,
);
console.log(
  `${results.length} duration boundary and upstream serialization checks passed; no real job submitted.`,
);
