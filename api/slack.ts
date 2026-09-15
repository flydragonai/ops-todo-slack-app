import { receiver } from '../src/app';

// Vercel's zero-config Web Standard handler shape for a Node function in /api.
// Using the raw `Request` object (rather than the legacy req/res + request.body
// helpers) avoids any risk of the body being parsed/consumed before Slack's
// signature verification can read it.
export default {
  fetch(request: Request): Promise<Response> {
    return receiver.handle(request);
  },
};
