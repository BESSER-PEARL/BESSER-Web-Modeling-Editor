import express from 'express';
import cors from 'cors';
import { UmlAgentRateLimiterResource } from './resources/uml-agent-rate-limiter-resource';

// options for cors midddleware
const options: cors.CorsOptions = {
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'X-Access-Token'],
  credentials: true,
  methods: 'GET,HEAD,OPTIONS,PUT,PATCH,POST,DELETE',
  preflightContinue: false,
};

export const register = (app: express.Application) => {
  const umlAgentRateLimiterResource = new UmlAgentRateLimiterResource();
  const router = express.Router();
  router.use(cors(options));

  // routes
  router.post('/uml-agent/rate-limit/check', (req, res) => umlAgentRateLimiterResource.checkRateLimit(req, res));
  router.delete('/uml-agent/rate-limit/check', (req, res) => umlAgentRateLimiterResource.resetRateLimit(req, res));
  app.use('/api', router);
};
