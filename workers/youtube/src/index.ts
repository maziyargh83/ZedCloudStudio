/** Deployment boundary reserved for YouTube publishing. No transcoding runs here. */
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET')
      return Response.json({ service: 'z-cloud-youtube', status: 'unconfigured' });
    return Response.json(
      { error: 'YouTube OAuth and upload integration are not configured.' },
      { status: 501 },
    );
  },
};
