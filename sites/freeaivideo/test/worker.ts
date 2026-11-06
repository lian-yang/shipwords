import { WorkflowEntrypoint } from 'cloudflare:workers';

export class TestWorkflow extends WorkflowEntrypoint<Cloudflare.Env, { jobId: string }> {
  async run() {}
}

export default {
  fetch: () => new Response('Isolated freeaivideo test worker'),
};
